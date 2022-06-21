import * as React from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { IDownloadTestResults } from '../types/types';
import { types, Icon, util, FormInput } from 'vortex-api';
import forumPost from '../util/forum-post';
import { clipboard } from 'electron';
import { getData as getCountries } from 'country-list';
import { Button, FormGroup, Alert, Row, Col, ControlLabel } from 'react-bootstrap';
import Select from 'react-select';

const forumUrl = 'https://forums.nexusmods.com/index.php?app=forums&module=post&section=post&do=new_post&f=117';
const premiumUrl = 'https://users.nexusmods.com/account/billing/premium';
const accountSettingsUrl = 'https://www.nexusmods.com/users/myaccount';


interface IProps {
    dlResults: IDownloadTestResults;
}

const Results = (props: IProps): JSX.Element => {
    const { t } = useTranslation(['download-tester']);
    const nexusAccount = useSelector((state: types.IState) => (state.persistent as any).nexus?.userInfo);
    const [countries, updateCountries] : [{label: string, value: string}[], React.Dispatch<any>] = React.useState(getCountries().map(c => ({ label: c.name, value: c.code })));
    const [isp, setIsp]: [string, React.Dispatch<any>] = React.useState();
    const [dlSpeed, setDlSpeed]: [number, React.Dispatch<any>] = React.useState(undefined);
    const [selectedCountry, selectCountry]: [string, React.Dispatch<any>] = React.useState();
    const { dlResults } = props;

    const recommendations: JSX.Element[] = [];

    if (!nexusAccount?.isPremium) recommendations.push(premiumRecommendation(t));

    if (betterServerAvailable(dlResults)) recommendations.push(changeServerRecommendation(t, nexusAccount?.isPremium, dlResults));

    if (allServersAreSlow(dlResults)) recommendations.push(ispIssue(t));

    const submitReport = () => {
        const country = countries.find(c => c.value === selectedCountry);
        const forumTemplate: string = forumPost(country.label, isp, dlSpeed, dlResults);
        clipboard.writeText(forumTemplate);
        return util.opn(forumUrl).catch(() => undefined);
    }

    return (
        <div>
            <h3>{t('Recommendations')}</h3>
            {t('To get the best out of your Nexus Mods downloads, here are your recommendations.')}
            <div>
            {recommendations.length ? recommendations : t('No recommendations.')}
            </div>
            <h3>{t('Report Download Issues')}</h3>
            {t('If you would like to report your results to the Nexus Mods team please fill in the details below.')}
            <FormGroup>
                <ControlLabel>{t<string>('Country')}</ControlLabel>
                <Select 
                    options={countries}
                    value={selectedCountry}
                    onChange={(v: { label: string, value: string }) => selectCountry(v?.value)}
                    placeholder={t('Select your country...')}
                />
            </FormGroup>
            <FormGroup>
                <ControlLabel>{t<string>('Internet Service Provider')}</ControlLabel>
                <FormInput 
                    value={isp}
                    placeholder={t('e.g. Virgin Media')}
                    onChange={(newVal: string) => setIsp(newVal)}
                />
            </FormGroup>
            <FormGroup>
                <ControlLabel>{t<string>('Download Speed (MB/s)')}</ControlLabel>
                <FormInput 
                    value={dlSpeed}
                    placeholder={t('e.g. 5MB/s')}
                    onChange={(newVal: string) => setDlSpeed(newVal.length ? parseInt(newVal) : undefined)}
                    type='number'
                    min={0}
                />
            </FormGroup>
            <Button disabled={!dlSpeed || !isp || !selectedCountry} onClick={submitReport}>
                {t<string>('Submit report')}
            </Button>
            <p>{t('Clicking "Submit report" will copy the relevant data to your clipboard and open the new thread page in the Nexus Mods support forums. You will need to paste in your results and add a title in order to complete the post.')}</p>
        </div>
    );
}

const ispIssue = (t): JSX.Element => {
    return renderAlert(
        'warning',
        'download-speed',
        t('Possible ISP or routing issue'),
        t('It seems that your download speed is very slow from all our servers around the world. This implies that it\'s an issue with your Internet Service Provider (ISP) or a localised routing problem.'
        +'Please contact your ISP or consider retrying the tests with a VPN active.')
    )
}

const premiumRecommendation = (t): JSX.Element => {
    return renderAlert(
        'info',
        'plugin-master',
        t('Get uncapped downloads with Premium'),
        t('As a non-Premium user, your download speed is capped to 1-2MB/s. Supporting our community is a Premium member will allow you to download as fast as your connection allows.'),
        <Button onClick={() => util.opn(premiumUrl).catch(() => undefined)}>{t('Learn More')} <Icon name='open-in-browser' /></Button>
    );
}

const changeServerRecommendation = (t, isPremium: boolean, res: IDownloadTestResults): JSX.Element => {
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

const renderAlert = (alertClass:string, iconName: string, title, text: string, button?: JSX.Element): JSX.Element => {
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