import { useState, useEffect, useCallback } from 'react';
import { ConfigProvider, theme as antTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { invoke } from '@tauri-apps/api/core';
import { useTheme } from './hooks/useTheme';
import { useLibrary } from './hooks/useLibrary';
import { useSettings } from './hooks/useSettings';
import LibraryToolbar from './components/layout/LibraryToolbar';
import Sidebar from './components/layout/Sidebar';
import LibraryList from './components/library/LibraryList';
import StatusBar from './components/common/StatusBar';
import FileViewer from './components/viewer/FileViewer';
import ImportDialog from './components/import/ImportDialog';
import './App.css';

function App() {
  const { theme: currentTheme } = useTheme();
  const { libraryInfo, openLibrary, closeLibrary, refreshInfo } = useLibrary();
  const { settings, updateSettings } = useSettings();

  const [viewingFileId, setViewingFileId] = useState<number | null>(null);
  const [filter, setFilter] = useState<any>({});
  const [showImport, setShowImport] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [appVersion, setAppVersion] = useState('');
  const [filteredTotalCount, setFilteredTotalCount] = useState<number | undefined>(undefined);

  useEffect(() => {
    invoke<string>('get_app_version').then(setAppVersion).catch(() => {});
  }, []);

  // Auto-open last library on mount
  useEffect(() => {
    if (settings.defaultLibraryPath && !libraryInfo) {
      openLibrary(settings.defaultLibraryPath).catch(() => {
        updateSettings({ defaultLibraryPath: '' });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenLibrary = useCallback(async (path: string) => {
    await openLibrary(path);
    updateSettings({ defaultLibraryPath: path });
    setRefreshKey(k => k + 1);
    setFilteredTotalCount(undefined);
  }, [openLibrary, updateSettings]);

  const handleImportComplete = useCallback(() => {
    setRefreshKey(k => k + 1);
    refreshInfo().catch(() => {});
  }, [refreshInfo]);

  const handleCloseLibrary = useCallback(() => {
    closeLibrary();
    updateSettings({ defaultLibraryPath: '' });
    setViewingFileId(null);
    setFilteredTotalCount(undefined);
  }, [closeLibrary, updateSettings]);

  const themeConfig = {
    algorithm: currentTheme === 'dark' ? antTheme.darkAlgorithm : undefined,
  };
  const getPopupContainer = () => document.getElementById('root') || document.body;

  if (viewingFileId !== null) {
    return (
      <ConfigProvider
        locale={zhCN}
        theme={themeConfig}
        getPopupContainer={getPopupContainer}
      >
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
          <FileViewer fileId={viewingFileId} onClose={() => setViewingFileId(null)} />
        </div>
      </ConfigProvider>
    );
  }

  const hasLibrary = !!libraryInfo;

  return (
    <ConfigProvider
      locale={zhCN}
      theme={themeConfig}
      getPopupContainer={getPopupContainer}
    >
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <LibraryToolbar
          libraryName={libraryInfo?.name || ''}
          hasLibrary={hasLibrary}
          onOpenLibrary={handleOpenLibrary}
          onCloseLibrary={handleCloseLibrary}
          onImportClick={() => setShowImport(true)}
        />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          <Sidebar filter={filter} onFilterChange={setFilter} />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {hasLibrary ? (
              <>
                <LibraryList
                  key={refreshKey}
                  filter={filter}
                  onOpenFile={(id) => setViewingFileId(id)}
                  onTotalCountChange={setFilteredTotalCount}
                  onMutateDone={() => refreshInfo().catch(() => {})}
                />
                <StatusBar
                  libraryName={libraryInfo.name}
                  libraryPath={libraryInfo.path}
                  appVersion={appVersion}
                  currentFiles={filteredTotalCount}
                  totalFiles={libraryInfo.total_files}
                  totalSize={libraryInfo.total_size}
                  totalCompressedSize={libraryInfo.total_compressed_size}
                />
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
                  <div style={{ fontSize: 16, marginBottom: 8 }}>欢迎使用 LittleFile</div>
                  <div style={{ fontSize: 13 }}>点击上方「新建库」或「打开库」开始使用</div>
                  <div style={{ fontSize: 12, marginTop: 8 }}>
                    按 <code style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 3 }}>F1</code> 查看快捷键
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ImportDialog open={showImport} onClose={() => setShowImport(false)}
        onComplete={handleImportComplete} />
    </ConfigProvider>
  );
}

export default App;
