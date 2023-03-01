import * as React from 'react';
import { Button } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import downloadTests from '../util/download-tests';
import QuickChecks from './QuickChecks';
import Start from './Start';
import DownloadTest from './DownloadTest';
import Results from './Results';
import Report from './Report';
import { types, Modal, MainContext } from 'vortex-api';
import { IDownloadTestResults, ITestProgress } from '../types/types';

interface IBaseProps {
    visible: boolean;
    onHide: () => void;
}

type IProps = IBaseProps;

type TestStage = 'start' | 'quick-checks' | 'download-tests' | 'result' | 'report';

function DownloadTester(props: IProps): JSX.Element {
    const stages: TestStage[] = ['start', 'quick-checks', 'download-tests', 'result', 'report'];
    const { visible, onHide } = props;
    const { t } = useTranslation(['download-tester']);
    const nexusAccount = useSelector((state: types.IState) => (state.persistent as any).nexus?.userInfo);
    const minSpeed = (nexusAccount?.isPremium || nexusAccount?.isSupporter) ? 2 : 1;
    const [modalStage, setModalStage]: [TestStage, React.Dispatch<any>] = React.useState('start' as TestStage);
    const [downloadTesting, setDownloadTesting]: [boolean, React.Dispatch<boolean>] = React.useState(false);
    const [downloadTestResults, setDownloadTestResults]: [IDownloadTestResults, React.Dispatch<any>] = React.useState(undefined);
    const [testStage, setTestStage]: [ITestProgress, React.Dispatch<ITestProgress | undefined>] = React.useState(undefined);
    const context: types.IExtensionContext = React.useContext(MainContext as any);

    React.useEffect(() => {
        // Reset the modal if it is closed.
        if (!visible) setModalStage(stages[0]);
    }, [visible]);

    React.useEffect(() => {
        if (modalStage === 'download-tests' && !downloadTestResults) {
            // Do the download test.
            setDownloadTesting(true);
            downloadTests(context, minSpeed, setTestStage)
            .then((res) => {
                setDownloadTestResults(res);
                setDownloadTesting(false);
            });
        }
    }, [modalStage, downloadTestResults])

    const renderStage = (stage: TestStage) => {
        switch(stage) {
            case 'start': return <Start />
            case 'quick-checks': return <QuickChecks />
            case 'download-tests': return (
                <DownloadTest 
                stage={testStage} 
                dlResults={downloadTestResults}
                setResults={setDownloadTestResults}
                />
            );
            case 'result': return <Results dlResults={downloadTestResults} setModalStage={setModalStage} />;
            case 'report': return <Report dlResults={downloadTestResults} />;
            default: return <Start />;
        }
    }

    const nextStage = () => {
        if (['result', 'report'].includes(modalStage)) return onHide();
        const idx = stages.indexOf(modalStage) + 1;
        setModalStage(stages[idx]);
    }

    const disableNext = (): boolean => {
        if (modalStage === 'download-tests' && downloadTesting === true) return true;
        else return false;
    }

    return (
        <Modal id='' show={visible} onHide={() => {}}>
            <Modal.Header>
                <h2>{t('Nexus Mods Download Speed Test')}</h2>
            </Modal.Header>
            <Modal.Body style={{maxHeight: '45em', overflow: 'auto'}}>
                {renderStage(modalStage)}
            </Modal.Body>
            <Modal.Footer>
                <Button onClick={onHide} disabled={downloadTesting}>{t<string>('Cancel')}</Button>
                <Button onClick={nextStage} disabled={disableNext()}>{['result', 'report'].includes(modalStage) ? t<string>('Done') : t<string>('Next')}</Button>
            </Modal.Footer>
        </Modal>
    );
}

export default DownloadTester;