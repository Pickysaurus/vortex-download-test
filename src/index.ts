import { actions, types, util } from "vortex-api";
// import DownloadTester from './views/DownloadTester';

function main(context: types.IExtensionContext) {
    context.registerDialog('nexus-downloadtest', util.LazyComponent(() => require('./views/DownloadTester')), () => {});

    context.registerAction('download-actions', 1000, 'download-speed', {}, 'Speed Test', () => {
        context.api.store.dispatch(actions.setDialogVisible('nexus-downloadtest'));
    }, () => true);

    return true;
}

module.exports = {
    default: main,
};