import * as React from 'react';
import { useSelector } from 'react-redux';
import { useTranslation, TFunction } from 'react-i18next';
import { IDownloadTestResults } from '../types/types';
import { types, Icon, util } from 'vortex-api';
import { Button, Alert, Row, Col } from 'react-bootstrap';

const premiumUrl = 'https://users.nexusmods.com/account/billing/premium';
const accountSettingsUrl = 'https://www.nexusmods.com/users/myaccount';


interface IProps {
    dlResults: IDownloadTestResults;
    setModalStage: React.Dispatch<string>;
}

const Results = (props: IProps): JSX.Element => {
    const { t } = useTranslation(['download-tester']);
    const nexusAccount = useSelector((state: types.IState) => (state.persistent as any).nexus?.userInfo);
    const { dlResults, setModalStage } = props;

    const recommendations: JSX.Element[] = [];

    if (!nexusAccount?.isPremium) recommendations.push(premiumRecommendation(t));

    if (betterServerAvailable(dlResults)) recommendations.push(changeServerRecommendation(t, nexusAccount?.isPremium, dlResults));

    if (allServersAreSlow(dlResults)) recommendations.push(ispIssue(t));

    return (
        <div>
            <h3>{t('Recommendations')}</h3>
            {t('To get the best out of your Nexus Mods downloads, here are your recommendations.')}
            <div>
            {recommendations.length ? recommendations : noRecommendations(t) }
            </div>
            <h3>{t('Still having problems?')}</h3>
            {t('If you\'re still having problems and would like to have your results reviewed by the Nexus Mods team click the button below.')}
            <div><Button onClick={() => setModalStage('report')} >{t('Report download issue')}</Button></div>
        </div>
    );
}

const noRecommendations = (t: TFunction): JSX.Element => {
    return renderAlert(
        'success',
        'toggle-enabled',
        t('No recommendations'),
        t('Vortex could not determine any recommendations to improve your setup.')
    )
}

const ispIssue = (t: TFunction): JSX.Element => {
    return renderAlert(
        'warning',
        'download-speed',
        t('Possible ISP or routing issue'),
        t('It seems that your download speed is very slow from all our servers around the world. This implies that it\'s an issue with your Internet Service Provider (ISP) or a localised routing problem.'
        +'Please contact your ISP or consider retrying the tests with a VPN active.')
    )
}

const premiumRecommendation = (t: TFunction): JSX.Element => {
    return renderAlert(
        'info',
        'plugin-master',
        t('Get uncapped downloads with Premium'),
        t('As a non-Premium user, your download speed is capped to 1-2MB/s. Supporting our community is a Premium member will allow you to download as fast as your connection allows.'),
        <Button onClick={() => util.opn(premiumUrl).catch(() => undefined)}>{t('Learn More')} <Icon name='open-in-browser' /></Button>
    );
}

const changeServerRecommendation = (t: TFunction, isPremium: boolean, res: IDownloadTestResults): JSX.Element => {
    if (isPremium) {
        const best = Object.keys(res.serverTests)[0];

        return renderAlert(
            'info',
            'feedback-info',
            t('Change your default download server'),
            t('As a Premium member, you can change your preferred download server in your account settings. The {{best}} server has the fastest speed from your location.', { replace: { best } }),
            <Button onClick={() => util.opn(accountSettingsUrl).catch(() => undefined)}>{t('Manage settings')} <Icon name='open-in-browser' /></Button>
        );
    }
    else {
        return renderAlert(
            'info',
            'feedback-info',
            t('Choose a preferred server with Premium'),
            t('Your connection to your default download server is slower than another option. Premium users can pick a preferred server to download from.'),
            <Button onClick={() => util.opn(premiumUrl).catch(() => undefined)}>{t('Go Premium')} <Icon name='open-in-browser' /></Button>
        );
    }
}

function allServersAreSlow(results: IDownloadTestResults): boolean {
    const slowServers = Object.entries(results.serverTests).filter(([key, value]) => !['High', 'Best'].includes(value.rating));
    if (slowServers.length === Object.keys(results.serverTests).length) return true;
    return false;
}

function betterServerAvailable(results: IDownloadTestResults): boolean {
    const cdn = results.cdnTest;
    const cdnGood = ['High', 'Best'].includes(cdn.rating);
    if (cdnGood) return false;
    const goodServers = Object.entries(results.serverTests).filter(([key, res]) => {
        if (res.speed > (cdn.speed * 1.1)) return true;
    });
    return goodServers.length ? true : false;
}

const renderAlert = (alertClass:string, iconName: string, title: string, text: string, button?: JSX.Element): JSX.Element => {
    return (
        <Alert bsStyle={alertClass} style={{margin: '4px 0'}}>
            <Row>
            <Col sm={1}>
            <Icon name={iconName} />
            </Col>
            <Col style={{whiteSpace: 'normal'}}>
            <b>{title}</b>
            <p>{text}</p>
            {button || null}
            </Col>
            </Row>
        </Alert>
    ); 
}

export default Results;