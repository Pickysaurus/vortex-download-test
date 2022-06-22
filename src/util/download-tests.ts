import { exec } from 'child_process';
import util from 'util';
import { actions, types, log } from 'vortex-api';
import { IDownloadTestResults, ITestServer, ITestProgress } from '../types/types';
import * as axios from 'axios';

const execProm = util.promisify(exec);
const timeoutProm = util.promisify((time: number, cb: () => void) => setTimeout(cb, time));

const traceCommand: string = 'tracert files.nexus-cdn.com';

const testTimeMs: number = 16000; // 31 seconds as we record the last 30 seconds worth of speed. This allows a second for the connection to start. 


const testServers: ITestServer[] = [
    {
        name: 'Worldwide - Premium CDN',
        url: 'https://nexus-speedtest.b-cdn.net/500MB.bin'
    },
    {
        name: 'EU - Amsterdam',
        url: 'http://amsterdam.nexus-cdn.com/500M'
    },
    {
        name: 'EU - Prague',
        url: 'http://prague.nexus-cdn.com/500M'
    },
    {
        name: 'US - Los Angeles',
        url: 'http://la.nexus-cdn.com/500M'
    },
    {
        name: 'US - Chicago',
        url: 'http://chicago.nexus-cdn.com/500M'
    },
    {
        name: 'US - Miami',
        url: 'http://miami.nexus-cdn.com/500M'
    },
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

async function testForDownloadLink(api: types.IExtensionApi, url: string): Promise<string> {
    const values = url.replace('nxm://', '').split('/');
    const [ gameId, modId, fileId ] = [ values[0], values[2], values[4] ];
    const state = api.getState();
    const APIKey = (state.confidential.account as any)?.nexus?.APIKey;
    if (!APIKey) throw new Error('Not logged in to Nexus Mods');
    try {
        const dlLink = await axios.default.get(`https://api.nexusmods.com/v1/games/${gameId}/mods/${modId}/files/${fileId}/download_link.json`, { headers: { apikey: APIKey } });
        const cdnLink: string = dlLink.data[0].URI;
        return cdnLink;
    }
    catch(err) {
        throw err;
    }
}

async function testDownloadServer(api: types.IExtensionApi, server: ITestServer): Promise<number> {
    if (!server.url) throw new Error('No download URL detected for '+server.name);

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
    
    const downloadCallback = async (err: Error, id: string): Promise<number> => {
        if (err) throw new Error('Download test failed: '+err);
        // Wait 30 seconds to get a good sample.
        await timeoutProm(testTimeMs);
        return testEnd(id);
    }

    // start the download.
    return new Promise(async (resolve, reject) => {
        // Clear the download speed graph
        api.store.dispatch(actions.setDownloadSpeeds(new Array(30).fill(0)));
        api.events.emit('start-download', [server.url], { game: 'site' }, `Nexus Mods Download test - ${server.name}`, 
        (err: Error, id: string) => {
            // THIS DOESN'T RETURN UNTIL THE DOWNLOAD COMPLETES OR IS STOPPED!
            if (!!err) return reject('Download test failed: '+err);
            return resolve(downloadCallback(err, id));
        }, 'replace');
        await timeoutProm(1000);
        const state = api.getState();
        const downloads = state.persistent?.downloads?.files || {};
        Object.keys(downloads).map(key => (downloads[key] as any).id = key);
        const dl: any = Object.values(downloads).find(d => d.urls.includes(server.url));
        if (dl) return resolve(downloadCallback(undefined, dl.id));
    });
}

async function runDownloadTests(context: types.IExtensionContext, minSpeed: number, status: (current: ITestProgress) => void): Promise<IDownloadTestResults> {
    
    const serversToTest = [...testServers];
    let progress = 0;
    const step = 100 / 11;
    status({message: 'Starting download tests...', progress});
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
                serversToTest.unshift({ name: 'Nexus Mods CDN', url: result });
            }
        }
        catch(err) {
            log('error', 'Could not test CDN links', {err, file});
            if (key === 'large') {
                serversToTest.unshift({ name: 'Nexus Mods CDN', url: undefined });
            }
        }
        
    }

    
    // Perform the download test for each CDN node.
    for (const server of serversToTest) {
        status({message: `Testing download server: ${server.name}`, progress: progress += step});
        try {
            const speed = await testDownloadServer(context.api, server);
            if (server.name === 'Nexus Mods CDN') {
                results.cdnTest = { speed, rating: getRating(speed, minSpeed) };
                continue;
            }
            if (!results.serverTests[server.name]) {
                // Ensure we only write the value once, as this can be called in two different places.
                results.serverTests[server.name] = { speed, rating: getRating(speed, minSpeed) };
            };
        }
        catch(err) {
            log('error', 'Error running server download test', { err, name: server.name });
            if (server.name === 'Nexus Mods CDN') {
                results.cdnTest = { speed: 0, rating: 'Error' };
                continue;
            }
            results.serverTests[server.name] = { speed: 0, rating: 'Error' };
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
