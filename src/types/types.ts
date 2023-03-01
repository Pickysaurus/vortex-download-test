import { types } from "vortex-api";

interface IDownloadTestResults {
    serverTests: {
        [id: string]: IDownloadResult;
    }
    cdnTest: IDownloadResult | undefined;
    trace: string | undefined;
    smallFileExample?: string;
    largeFileExample?: string;
}

interface IDownloadResult {
    speed: number;
    rating: 'Best' | 'High' | 'Medium' | 'Low' | 'Error';
}

interface IDownloadWithId extends types.IDownload {
    id: string
}

interface ITestProgress {
    message: string;
    progress: number;
}

interface ITestServer {
    name: string;
    url?: string;
}

interface ITestWithRating {
    name: string;
    result: number;
    rating: 'High' | 'Medium' | 'Low';
}

export { IDownloadTestResults, IDownloadWithId, ITestProgress, ITestServer, ITestWithRating };