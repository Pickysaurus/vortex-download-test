import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from 'vortex-api';


const Start = (): JSX.Element => {
    const { t } = useTranslation(['download-tester']);

    const troubleshootLink = <a href={'https://help.nexusmods.com/article/113-troubleshooting-website-issues'}>{t('Troubleshooting website issues')}</a>;

    return (
        <div>
            <p>
                {t('This troubleshooter will allow you to test your connection to the Nexus Mods CDN and help you to diagnose the cause of download speed problems. ')}
                <a href='https://help.nexusmods.com/article/92-im-having-download-issues-what-can-i-do'>{t('Learn More.')}</a>
            </p>
            <p>{t('To ensure the best results from the download tests, please make sure you stop any other downloads from Steam, Windows Update or any other apps that are currently running.')}</p>
            <p><Icon name='feedback-info' /> {t('Sometimes browser settings/addons can cause downloads to fail to start. If you\'re having this problem please see ')}{troubleshootLink}{t('.')}</p>
        </div>
    );
}

export default Start;

{/* <ul>
<li>
<b>{t('Downloads don\'t start')}</b><br/>
{t('You should consult our ')}{troubleshootLink}{t(' page. This is normally caused by browser settings.')}
</li>
<br/>
<li>
<b>{t('Make sure you stop any other downloads')}</b><br />
{t('Check Steam, Windows Update or any apps that download in the background.')}
</li>
</ul> */}