import * as React from 'react';
import { Alert, Row, Col } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { types, Icon } from 'vortex-api';
import * as remote from '@electron/remote';
import * as semver from 'semver';

const app = remote.app;

const QuickChecks = (): JSX.Element => {

    const maxBandwidth = useSelector((state: types.IState) => state.settings?.downloads?.maxBandwidth || 0);
    const nexusAccount = useSelector((state: types.IState) => (state.persistent as any).nexus?.userInfo);
    const downloadThreads = useSelector((state: types.IState) => state.settings?.downloads?.maxParallelDownloads || 1);
    const latestVortex = useSelector((state: types.IState) => (state.persistent as any).nexus?.newestVersion || '0.0.0');
    const networkConnected = useSelector((state: types.IState) => state.session.base?.networkConnected || false);
    const { t } = useTranslation(['download-tester']);
    const currentVortex = app.getVersion();

    return (
        <div>
            {t('The information below shows any issues in your settings which may allow you to quickly fix download problems.'
            + 'This covers any account issues or settings in Vortex that may reduce or improve your download speeds.')}
            {vortexVer(latestVortex, currentVortex, t)}
            {network(networkConnected, t)}
            {userAccountStatus(nexusAccount, t)}
            {bandwithLimit(maxBandwidth, t)}
            {dlThreads(downloadThreads, nexusAccount, t)}
        </div>
    )
}

const network = (connection, t): JSX.Element => {
    return renderAlert(
        connection === true ? 'success' : 'danger',
        connection === true ? 'toggle-enabled' : 'toggle-disabled',
        t('Network Connection'),
        connection === true ? t('You are connected to the internet.') : t('You are not connected to the internet, please check your network or security settings.')
    );
}

const vortexVer = (latest, current, t): JSX.Element => {
    if (semver.gte(current, latest)) return renderAlert(
        'success',
        'toggle-enabled',
        t('Vortex version'),
        t('You are using the latest version of Vortex ({{current}}).', { replace: { current } })
    );

    return renderAlert(
        'warning',
        'feedback-info',
        t('Vortex version'),
        t('Your version of Vortex is out of date ({{current}}), please update to {{latest}}.', { replace:{ latest, current } })
    );
}

const dlThreads = (threadCount, nexus, t): JSX.Element => {
    if (!nexus?.isPremium) return renderAlert(
        'success',
        'toggle-enabled',
        t('Download threads'),
        t('You are using all available download threads.')
    );
    else return renderAlert(
        'success',
        'feedback-info',
        t('Download threads'),
        t('You are using {{threadCount}} download threads, Premium users can adjust this value in the download settings.', { replace: { threadCount }})
    );
}

const bandwithLimit = (maxBandwidth, t): JSX.Element => {
    if (maxBandwidth === 0) return renderAlert(
        'success',
        'toggle-enabled',
        t('Bandwidth Limit'),
        t('No bandwidth limit set.')
    )
    else return renderAlert(
        'info',
        'feedback-info',
        t('Bandwidth Limit'),
        t('You have a bandwidth limit of {{limit}}MB/s set in in your download settings. Vortex will not exceed this speed when downloading.',
        { replace: { limit: maxBandwidth / (1024 * 1024) }})
    )
}

const userAccountStatus = (nexus, t): JSX.Element => {
    if (!nexus) return renderAlert(
        'warning', 
        'toggle-disabled',
        t('Nexus Mods Account'),
        t('Your are not currently logged into a Nexus Mods account.')
    );
    
    const membership = nexus?.isPremium ? 'Premium member' : nexus?.isSupporter ? 'Supporter' : 'Free user';
    const dl = nexus?.isPremium ? 'Unlimited' : nexus?.isSupporter ? '2MB/s' : '1-2MB/s';

    return renderAlert(
        'success', 
        'toggle-enabled',
        t('Nexus Mods Account'),
        t('Logged in: {{name}} ({{membership}}). Maximum download speed: {{dl}}', { replace: { name: nexus.name, membership, dl } })
    );
}

const renderAlert = (alertClass:string, iconName: string, title, text: string): JSX.Element => {
    return (
        <Alert bsStyle={alertClass} style={{margin: '4px 0'}}>
            <Row>
            <Col sm={1}>
            <Icon name={iconName} />
            </Col>
            <Col style={{whiteSpace: 'normal'}}>
            <b>{title}</b>
            <p>{text}</p>
            </Col>
            </Row>
        </Alert>
    ); 
}



export default QuickChecks;