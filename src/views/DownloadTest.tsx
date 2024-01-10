import * as React from 'react';
import { Button, Jumbotron, Panel } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { ProgressBar, Spinner, Icon } from 'vortex-api';
import { IDownloadTestResults, ITestProgress } from '../types/types';

interface IProps {
    stage: ITestProgress;
    dlResults: IDownloadTestResults;
    setResults: React.Dispatch<any>;
}

const DownloadTest = (props: IProps): JSX.Element => {
    const { t } = useTranslation(['download-tester']);
    const [traceExpanded, setTraceExpanded] = React.useState(false);
    const { stage, dlResults, setResults } = props;

    const reset = () => setResults(undefined);

    const renderStage = () => {
        return (
            <div>
                <Jumbotron style={{ textAlign: 'center', padding: '24px', backgroundColor: 'var(--brand-bg)' }}>
                    <p><Spinner /> {t(stage.message)}</p>
                    <ProgressBar now={stage.progress} min={0} max={100} />
                </Jumbotron>

            </div>
        );
    }

    const tracePanelTitle = t('Full Results');

    const renderResults = () => {
        return (<div>
            <table style={{width: '100%'}}>
                <thead>
                <tr>
                    <th>{t('Test Server')}</th>
                    <th>{t('Speed')}</th>
                    <th>{t('Rating')}</th>
                </tr>
                </thead>
                <tbody>
                {
                    Object.keys(dlResults.serverTests)
                    .map(r => {
                        const val = dlResults.serverTests[r];

                        return (
                            <tr>
                                <td>{r}</td>
                                <td>{val.speed.toFixed(1)}MB/s ({(val.speed * 8).toFixed(1)}Mbps)</td>
                                <td>{val.rating}</td>
                            </tr>
                        );
                    })
                }
                </tbody>
            </table>
            <br />
            <Panel expanded={traceExpanded} eventKey={'tracePanel'} onToggle={() => null}>
                <Panel.Heading onClick={() => setTraceExpanded(!traceExpanded)}>
                    <Panel.Title><Icon name={traceExpanded ? 'showhide-down' : 'showhide-right'} /> {tracePanelTitle}</Panel.Title>
                </Panel.Heading>
                <Panel.Body collapsible>
                    <p><b>{t('Sample File Download Speed')}</b> {dlResults.cdnTest?.speed?.toFixed(1) || 0}MB/s ({((dlResults.cdnTest?.speed ?? 0) * 8).toFixed(1)})</p>
                    <p><b>{t('Small File Link')}</b> {dlResults.smallFileExample || t('Unable to resolve link')}</p>
                    <p><b>{t('Large File Link')}</b> {dlResults.largeFileExample || t('Unable to resolve link')}</p>
                    <b>{t('TraceRoute')}</b>
                    <pre>{dlResults.trace}</pre>
                </Panel.Body>
            </Panel>
            <Button onClick={reset}><><Icon name='refresh' /> {t('Re-run tests')}</></Button>
        </div>);
    }

    return (
        <div>
            <p>
                {!dlResults 
                ? t('Vortex will now perform a download test from each of the servers around the world to determine the best one for you. This can take a few minutes to complete.')
                : t('Download tests complete. You can review your test results below.')
                }
            </p>
            { stage ? renderStage() : null }
            { dlResults ? renderResults() : null }
        </div>
    );
}

export default DownloadTest;