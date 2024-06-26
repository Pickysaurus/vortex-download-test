import { exec } from 'child_process';
import util from 'util';
import { actions, types, log } from 'vortex-api';
import { IDownloadTestResults, ITestServer, ITestProgress } from '../types/types';
import * as axios from 'axios';

const execProm = util.promisify(exec);
const timeoutProm = util.promisify((time: number, cb: () => void) => setTimeout(cb, time));

const traceCommand: string = 'tracert files.nexus-cdn.com';

const testTimeMs: number = 16000; // 31 seconds as we record the last 30 seconds worth of speed. This allows a second for the connection to start. 

const speedTestQuery = `
    query speedTestUrls {
        speedtestUrls {
            title
            description
            location
            tag
        }
    }
`;

const testServers: ITestServer[] = [
    {
        title: "Cloudflare CDN",
        description: "Server location: Global",
        location: "https://cf-speedtest.nexusmods.com",
        tag: "NEXUS_CDN"
    },
    {
        title: "Amsterdam",
        description: "Server location: Amsterdam",
        location: "https://amsterdam.nexus-cdn.com",
        tag: "AMSTERDAM"
    },
    {
        title: "Prague",
        description: "Server location: Prague",
        location: "https://prague.nexus-cdn.com",
        tag: "PRAGUE"
    },
    {
        title: "Chicago",
        description: "Server location: Chicago",
        location: "https://chicago.nexus-cdn.com",
        tag: "CHICAGO"
    },
    {
        title: "Los Angeles",
        description: "Server location: Los Angeles",
        location: "https://losangeles.nexus-cdn.com",
        tag: "LOS_ANGELES"
    },
    {
        title: "Miami",
        description: "Server location: Miami",
        location: "https://miami.nexus-cdn.com",
        tag: "MIAMI"
    },
    {
        title: 'Asia - Singapore',
        description: "Server location: Singapore",
        location: 'https://singapore.nexus-cdn.com/',
        tag: 'SINGAPORE'
    }
];

const testCDN = {
    small: 'nxm://site/mods/415/files/1559',
    large: 'nxm://site/mods/415/files/1560',
};

async function getTraceRoute(): Promise<string> {
    try {
        const result = await execProm(traceCommand);
        if (result.stderr) throw new Error('Error in trace operation: '+result.stderr);
        else return result.stdout;
    }
    catch(err) {
        throw new Error('Could not complete TraceRoute: '+(err.stdout || err.stderr || err));
    }
}

async function testForDownloadLink(api: types.IExtensionApi, url: string, retry: boolean = true): Promise<string> {
    const values = url.replace('nxm://', '').split('/');
    const [ gameId, modId, fileId ] = [ values[0], values[2], values[4] ];
    const state = api.getState();
    try {
        // await api.ext.ensureLoggedIn() // This can ensure the user is logged into Nexus Mods, but it shows a modal prompting login if not.
        const token = (state.confidential.account as any)?.nexus?.OAuthCredentials.token;
        if (!token) throw new Error('Not logged in to Nexus Mods');
        const dlLink = await axios.default.get(`https://api.nexusmods.com/v1/games/${gameId}/mods/${modId}/files/${fileId}/download_link.json`, { headers: { 'Authorization': `Bearer ${token}` } });
        const cdnLink: string = dlLink.data[0].URI;
        return cdnLink;
    }
    catch(err) {
        if (err as axios.AxiosError) {
            const axiosError = err as axios.AxiosError;
            if (axiosError.response?.status === 401 && retry) {
                try {
                    // On a 401 error, we try again after refreshing the user's session.
                    await api.ext.ensureLoggedIn?.()
                    return testForDownloadLink(api, url, false)
                }
                catch(err2) {
                    throw err2;
                }
            }
        }
        throw err;
    }
}

async function testDownloadServer(api: types.IExtensionApi, server: ITestServer): Promise<number> {
    if (!server.location) throw new Error('No download URL detected for '+server.title);

    const testEnd = (dlId: string): number => {
        // Stop the download
        api.events.emit('remove-download', dlId);

        // collect the last few speed values from the state.
        const state = api.getState();
        const speedHistory: number[] = state.persistent?.downloads?.speedHistory;
        const speedHistoryMBps: number[] = speedHistory.map((bits: number) => bits/1e+6).slice(15);
        const average: number = speedHistoryMBps.reduce((a,b) => a + b, 0) / speedHistoryMBps.length;

        // Return an average
        return average;
    }
    
    const downloadCallback = async (err: Error|undefined, id: string): Promise<number> => {
        if (err) throw new Error('Download test failed: '+err);
        // Wait 30 seconds to get a good sample.
        await timeoutProm(testTimeMs);
        return testEnd(id);
    }

    // start the download.
    return new Promise(async (resolve, reject) => {
        // Clear the download speed graph
        api.store?.dispatch(actions.setDownloadSpeeds(new Array(30).fill(0)));
        api.events.emit('start-download', [server.location+'/500M'], { game: 'site' }, `Nexus Mods Download test - ${server.title}`, 
        (err: Error, id: string) => {
            // THIS DOESN'T RETURN UNTIL THE DOWNLOAD COMPLETES OR IS STOPPED!
            if (!!err) return reject('Download test failed: '+err);
            return resolve(downloadCallback(err, id));
        }, 'replace');
        await timeoutProm(1000);
        const state = api.getState();
        const downloads = state.persistent?.downloads?.files || {};
        Object.keys(downloads).map(key => (downloads[key] as any).id = key);
        const dl: any = Object.values(downloads).find(d => d.urls.includes(server.location!));
        if (dl) return resolve(downloadCallback(undefined, dl.id));
    });
}

async function runDownloadTests(context: types.IExtensionContext, minSpeed: number, status: (current?: ITestProgress) => void): Promise<IDownloadTestResults> {
    
    let serversToTest: ITestServer[] = [];
    let progress = 0;
    const step = 100 / 12;
    status({message: 'Starting download tests...', progress});
    try {
        status({message: 'Fetching available download servers...', progress});
        const servers = await axios.default.post(`https://api.nexusmods.com/v2/graphql`, { query: speedTestQuery });
        serversToTest = servers.data.data.speedtestUrls || [];
    }
    catch(err) {
        log('error', 'Unable to get a list of CDN locations, using fallback', err);
        // Use the hard-coded backups!
        serversToTest = [...testServers];
    }
    // Pause any active downloads
    const state = context.api.getState();
    const downloads = state.persistent?.downloads?.files || {};
    const activeDownloads = Object.keys(downloads).filter(k => ['init', 'started'].includes(downloads[k].state));
    if (activeDownloads.length) activeDownloads.map(id => context.api.events.emit('pause-download', id));

    let results: IDownloadTestResults = { serverTests: {}, cdnTest: undefined, trace: undefined };
    // Perform CDN download checks - attempt to verify the user's default server.
    for (const file of Object.entries(testCDN)) {
        const [key, value] = file;
        status({message: `Testing CDN connection for ${key} files`, progress: progress += step});
        const resKey = `${key}FileExample`;
        if (results[resKey]) continue;
        try {
            const result: string = await testForDownloadLink(context.api, value);
            results[resKey] = result;
            // If large test, we also want to work out the CDN server.
            if (key === 'large') {
                serversToTest.unshift({ title: 'Nexus Mods CDN', location: result, tag: 'LARGETEST', description:'' });
            }
        }
        catch(err) {
            log('error', 'Could not test CDN links', {err, file});
            if (key === 'large') {
                serversToTest.unshift({ title: 'Nexus Mods CDN', location: '', tag: 'NexusModsCDN', description: '' });
            }
        }
        
    }

    
    // Perform the download test for each CDN node.
    for (const server of serversToTest) {
        status({message: `Testing download server: ${server.title}`, progress: progress += step});
        try {
            const speed = await testDownloadServer(context.api, server);
            if (server.title === 'Cloudflare CDN') {
                results.cdnTest = { speed, rating: getRating(speed, minSpeed) };
                continue;
            }
            if (!results.serverTests[server.title]) {
                // Ensure we only write the value once, as this can be called in two different places.
                results.serverTests[server.title] = { speed, rating: getRating(speed, minSpeed) };
            };
        }
        catch(err) {
            log('error', 'Error running server download test', { err, name: server.title });
            if (server.title === 'Cloudflare CDN') {
                results.cdnTest = { speed: 0, rating: 'Error' };
                continue;
            }
            results.serverTests[server.title] = { speed: 0, rating: 'Error' };
        }
    }

    // Perform the traceroute test
    status({message: 'Starting TraceRoute test...', progress: progress += step});
    try {
        status({message: 'Testing TraceRoute...', progress});
        const result = await getTraceRoute();
        results.trace = result;
    }
    catch(err) {
        log('error', 'Error running TraceRoute test', err);
        results.trace = err.message;
    }

    // Resume any downloads we paused.
    if (activeDownloads.length) activeDownloads.map(id => context.api.events.emit('resume-download', id));

    // Return the result. 
    status(undefined);
    // Order the download results by speed.
    const orderedTests = Object.entries(results.serverTests)
    .sort(([key, value], [key2, value2]) => value2.speed - value.speed).reduce((prev, cur) => {
        const [key, value] = cur;
        prev[key] = results.serverTests[key];
        return prev;
    }, {});

    results.serverTests = orderedTests;
    // Mark the best result, if we have one.
    const bestRes = results.serverTests[Object.keys(orderedTests)[0]];
    if (!['Error', 'Low'].includes(bestRes.rating)) results.serverTests[Object.keys(orderedTests)[0]].rating = 'Best';

    return results;
}

function getRating(speed: number, min: number): ('High' | 'Medium' | 'Low' | 'Error') {
    if (speed === 0) return 'Error';
    else if (speed < (min * 0.9)) return 'Low';
    else if (speed > (min * 2)) return 'High';
    else return 'Medium';
}

export default runDownloadTests;
