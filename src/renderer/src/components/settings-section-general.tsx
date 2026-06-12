import type { ReactElement } from 'react'
import type { ApprovalPolicy, AppSettingsV1, SandboxMode } from '@shared/app-settings'
import {
  DEFAULT_WRITE_INLINE_COMPLETION_BASE_URL,
  DEFAULT_WRITE_INLINE_COMPLETION_MAX_TOKENS,
  DEFAULT_WRITE_INLINE_COMPLETION_MODEL,
  DEFAULT_WRITE_INLINE_LONG_COMPLETION_MAX_TOKENS,
  DEFAULT_DRAGON_DATA_DIR,
  isDragonRuntimeInsecure
} from '@shared/app-settings'
import type { GuiUpdateChannel } from '@shared/gui-update'
import type { SkillRootId } from '../lib/skill-root-preference'
import { FolderOpen, Loader2, PencilLine, RefreshCw, Settings } from 'lucide-react'
import { GuiUpdateControl } from './settings-gui-update'
import { SelectDropdown } from './SelectDropdown'
import {
  InlineNoticeView,
  SecretInput,
  SectionJumpButton,
  SettingsCard,
  SettingRow,
  Toggle
} from './settings-controls'

export function GeneralSettingsSection({ ctx }: { ctx: Record<string, any> }): ReactElement {
  const {
    t,
    tCommon,
    form,
    dragon,
    update,
    updateDragon,
    showRuntimeToken,
    setShowRuntimeToken,
    portError,
    openOnboardingPreview,
    pickWorkspace,
    resetWorkspaceToDefault,
    workspacePickerError,
    guiUpdateInfo,
    checkingGuiUpdate,
    downloadingGuiUpdate,
    installingGuiUpdate,
    guiUpdateDownloaded,
    guiUpdateProgress,
    guiUpdateError,
    checkGuiUpdate,
    downloadGuiUpdate,
    installGuiUpdate,
    logPath,
    logDirOpenError,
    setLogDirOpenError,
    pickWriteWorkspace,
    resetWriteWorkspaceToDefault,
    writeWorkspacePickerError,
    writeInlineBaseUrlInherited,
    effectiveWriteInlineBaseUrl,
    writeInlineModelInherited,
    effectiveWriteInlineModel,
    setWriteDebugModalOpen,
    loadWriteDebugEntries,
    scrollToAgentSection,
    agentsSectionRef,
    skillSectionRef,
    mcpSectionRef,
    permissionsSectionRef,
    selectedSkillRoot,
    skillRootOptions,
    skillRootId,
    setSkillRootId,
    skillNotice,
    openSkillRoot,
    openPlugins,
    mcpConfigPath,
    mcpConfigExists,
    mcpConfigText,
    setMcpConfigText,
    mcpLoading,
    mcpBusy,
    mcpNotice,
    saveMcpConfig,
    loadMcpConfig,
    openMcpConfigDir,
    pickClawWorkspace,
    resetClawWorkspaceToDefault,
    clawWorkspacePickerError,
    splitSettingsList,
    listSettingsText
  } = ctx
  const platform = typeof window !== 'undefined' ? window.sinoCode?.platform ?? '' : ''
  const openAtLoginSupported = platform === 'win32' || platform === 'darwin'
  const startMinimizedSupported = platform === 'win32'
  const desktopBehavior = form.appBehavior

  return (
            <>
              <SettingsCard title={t('sectionGeneral')}>
                <SettingRow
                  title={t('language')}
                  description={t('languageDesc')}
                  control={
                    <SelectDropdown
                      value={form.locale}
                      ariaLabel={t('language')}
                      options={[
                        { value: 'en', label: 'English' },
                        { value: 'zh', label: '简体中文' }
                      ]}
                      onChange={(value) => update({ locale: value as 'en' | 'zh' })}
                    />
                  }
                />
                <SettingRow
                  title={t('theme')}
                  description={t('themeDesc')}
                  control={
                    <SelectDropdown
                      value={form.theme}
                      ariaLabel={t('theme')}
                      options={[
                        { value: 'system', label: t('themeSystem') },
                        { value: 'light', label: t('themeLight') },
                        { value: 'dark', label: t('themeDark') }
                      ]}
                      onChange={(value) => update({ theme: value as AppSettingsV1['theme'] })}
                    />
                  }
                />
                <SettingRow
                  title={t('onboardingPreview')}
                  description={t('onboardingPreviewDesc')}
                  control={
                    <button
                      type="button"
                      onClick={openOnboardingPreview}
                      className="w-full rounded-xl border border-ds-border bg-ds-card px-3 py-2 text-[14px] font-medium text-ds-ink shadow-sm transition hover:bg-ds-hover"
                    >
                      {t('onboardingPreviewOpen')}
                    </button>
                  }
                />
                <SettingRow
                  title={t('fontScale')}
                  description={t('fontScaleDesc')}
                  control={
                    <SelectDropdown
                      value={form.uiFontScale}
                      ariaLabel={t('fontScale')}
                      options={[
                        { value: 'small', label: t('fontScaleSmall') },
                        { value: 'medium', label: t('fontScaleMedium') },
                        { value: 'large', label: t('fontScaleLarge') }
                      ]}
                      onChange={(value) =>
                        update({
                          uiFontScale: value as AppSettingsV1['uiFontScale']
                        })
                      }
                    />
                  }
                />
                <SettingRow
                  title={t('turnCompleteNotification')}
                  description={t('turnCompleteNotificationDesc')}
                  control={
                    <Toggle
                      checked={form.notifications.turnComplete}
                      onChange={(v) => update({ notifications: { turnComplete: v } })}
                    />
                  }
                />
                <SettingRow
                  title={t('workspaceRoot')}
                  description={t('workspaceRootDesc')}
                  control={
                    <div className="w-full min-w-[200px] md:max-w-xl">
                      <div className="flex items-center gap-2">
                        <input
                          className="w-full rounded-xl border border-ds-border bg-ds-card px-3 py-2 text-[14px] text-ds-ink shadow-sm focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/30"
                          value={form.workspaceRoot}
                          onChange={(e) => update({ workspaceRoot: e.target.value })}
                          placeholder={t('workspaceRootPlaceholder')}
                        />
                        <button
                          type="button"
                          onClick={resetWorkspaceToDefault}
                          className="shrink-0 rounded-xl border border-ds-border bg-ds-card px-3 py-2 text-[13px] font-medium text-ds-ink shadow-sm transition hover:bg-ds-hover"
                        >
                          {t('restoreWorkspaceDefault')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void pickWorkspace()}
                          className="shrink-0 rounded-xl border border-ds-border bg-ds-card px-3 py-2 text-[13px] font-medium text-ds-ink shadow-sm transition hover:bg-ds-hover"
                        >
                          {t('browse')}
                        </button>
                      </div>
                      {workspacePickerError ? (
                        <p className="mt-2 text-[13px] leading-5 text-amber-700 dark:text-amber-300">
                          {workspacePickerError}
                        </p>
                      ) : null}
                    </div>
                  }
                />
              </SettingsCard>

              <SettingsCard title={t('desktopBehavior')} className="mt-6">
                <SettingRow
                  title={t('desktopOpenAtLogin')}
                  description={
                    openAtLoginSupported
                      ? t('desktopOpenAtLoginDesc')
                      : t('desktopOpenAtLoginUnsupportedDesc')
                  }
                  control={
                    <Toggle
                      checked={desktopBehavior.openAtLogin}
                      disabled={!openAtLoginSupported}
                      onChange={(v) =>
                        update({
                          appBehavior: {
                            openAtLogin: v,
                            startMinimized: v ? desktopBehavior.startMinimized : false
                          }
                        })
                      }
                    />
                  }
                />
                <SettingRow
                  title={t('desktopStartMinimized')}
                  description={
                    desktopBehavior.openAtLogin && startMinimizedSupported
                      ? t('desktopStartMinimizedDesc')
                      : t('desktopStartMinimizedDisabledDesc')
                  }
                  control={
                    <Toggle
                      checked={desktopBehavior.startMinimized}
                      disabled={!desktopBehavior.openAtLogin || !startMinimizedSupported}
                      onChange={(v) => update({ appBehavior: { startMinimized: v } })}
                    />
                  }
                />
                <SettingRow
                  title={t('desktopCloseToTray')}
                  description={t('desktopCloseToTrayDesc')}
                  control={
                    <Toggle
                      checked={desktopBehavior.closeToTray}
                      onChange={(v) => update({ appBehavior: { closeToTray: v } })}
                    />
                  }
                />
              </SettingsCard>

              <SettingsCard title={t('guiUpdate')} className="mt-6">
                <SettingRow
                  title={t('guiUpdateChannel')}
                  description={t('guiUpdateChannelDesc')}
                  control={
                    <SelectDropdown
                      value={form.guiUpdate.channel}
                      ariaLabel={t('guiUpdateChannel')}
                      options={[
                        { value: 'frontier', label: t('guiUpdateChannelFrontier') },
                        { value: 'stable', label: t('guiUpdateChannelStable') }
                      ]}
                      onChange={(value) =>
                        update({
                          guiUpdate: { channel: value as GuiUpdateChannel }
                        })
                      }
                    />
                  }
                />
                <SettingRow
                  title={t('guiUpdate')}
                  description={t('guiUpdateDesc')}
                  control={
                    <GuiUpdateControl
                      info={guiUpdateInfo}
                      checking={checkingGuiUpdate}
                      downloading={downloadingGuiUpdate}
                      installing={installingGuiUpdate}
                      downloaded={guiUpdateDownloaded}
                      progress={guiUpdateProgress}
                      error={guiUpdateError}
                      onCheck={checkGuiUpdate}
                      onDownload={downloadGuiUpdate}
                      onInstall={installGuiUpdate}
                      t={t}
                    />
                  }
                />
              </SettingsCard>

              <SettingsCard title={t('logTitle')} className="mt-6">
                <SettingRow
                  title={t('logEnabled')}
                  description={t('logEnabledDesc')}
                  control={
                    <Toggle
                      checked={form.log.enabled}
                      onChange={(v) => update({ log: { enabled: v } })}
                    />
                  }
                />
                <SettingRow
                  title={t('logRetention')}
                  description={t('logRetentionDesc')}
                  control={
                    <SelectDropdown
                      value={form.log.retentionDays}
                      ariaLabel={t('logRetention')}
                      options={[
                        { value: 1, label: t('logRetentionOne') },
                        { value: 2, label: t('logRetentionTwo') },
                        { value: 3, label: t('logRetentionThree') },
                        { value: 5, label: t('logRetentionFive') },
                        { value: 7, label: t('logRetentionSeven') }
                      ]}
                      onChange={(value) =>
                        update({ log: { retentionDays: Number(value) } })
                      }
                    />
                  }
                />
                <SettingRow
                  title={t('logDir')}
                  description={t('logDirDesc')}
                  wideControl
                  control={
                    <div className="flex w-full min-w-0 flex-col items-start gap-2">
                      {logPath ? (
                        <code className="block w-full max-w-full break-all rounded-xl bg-ds-main/70 px-3 py-2 font-mono text-[12px] text-ds-muted shadow-sm">
                          {logPath}
                        </code>
                      ) : (
                        <span className="text-[13px] text-ds-faint">…</span>
                      )}
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-ds-border bg-ds-card px-3 py-1.5 text-[13px] font-medium text-ds-ink shadow-sm transition hover:bg-ds-hover disabled:opacity-50"
                        disabled={typeof window.sinoCode?.openLogDir !== 'function'}
                        onClick={async () => {
                          if (typeof window.sinoCode?.openLogDir !== 'function') return
                          setLogDirOpenError(null)
                          try {
                            const result = await window.sinoCode.openLogDir()
                            if (!result.ok) setLogDirOpenError(result.message ?? 'Unknown error')
                          } catch (e) {
                            setLogDirOpenError(e instanceof Error ? e.message : String(e))
                          }
                        }}
                      >
                        <FolderOpen className="h-4 w-4" />
                        {t('logDirOpen')}
                      </button>
                      {logDirOpenError ? (
                        <p className="text-[12px] text-red-700 dark:text-red-300">
                          {logDirOpenError}
                        </p>
                      ) : null}
                    </div>
                  }
                />
              </SettingsCard>
            </>
  )
}
