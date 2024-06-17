import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { IDownloadTestResults } from '../types/types';
import { util, FormInput } from 'vortex-api';
import forumPost from '../util/forum-post';
import { clipboard } from 'electron';
import { getData as getCountries } from 'country-list';
import { Button, FormGroup, ControlLabel } from 'react-bootstrap';
import Select from 'react-select';

const forumUrl = 'https://forums.nexusmods.com/forum/8871-download-speed-troubleshooting/?do=add';


interface IProps {
    dlResults: IDownloadTestResults;
}

const Report = (props: IProps): JSX.Element => {
    const { t } = useTranslation(['download-tester']);
    const [countries] : [{label: string, value: string}[], React.Dispatch<any>] = React.useState(getCountries().map(c => ({ label: c.name, value: c.code })));
    const [isp, setIsp]: [string | undefined, React.Dispatch<any>] = React.useState();
    const [dlSpeed, setDlSpeed]: [number | undefined, React.Dispatch<any>] = React.useState();
    const [selectedCountry, selectCountry]: [string | undefined, React.Dispatch<any>] = React.useState();
    const { dlResults } = props;

    const submitReport = () => {
        const country = countries.find(c => c.value === selectedCountry);
        if (!country || !isp || !dlSpeed) return;
        const forumTemplate: string = forumPost(country.label, isp, dlSpeed, dlResults);
        clipboard.writeText(forumTemplate);
        return util.opn(forumUrl).catch(() => undefined);
    }

    return (
        <div>
            <h3>{t('Report Download Issues')}</h3>
            {t('Please complete the following fields to help us understand more about your setup.')}
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
                    value={isp || ''}
                    placeholder={t('e.g. Virgin Media')}
                    onChange={(newVal: string) => setIsp(newVal)}
                />
            </FormGroup>
            <FormGroup>
                <ControlLabel>{t<string>('Download Speed (MB/s)')}</ControlLabel>
                <FormInput 
                    value={dlSpeed || ''}
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

export default Report;