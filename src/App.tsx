import { AnimatePresence, motion } from 'framer-motion'
import { BriefcaseBusiness, Loader2, LockKeyhole, UserRound, X } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent, type PointerEvent } from 'react'
import { DemoProvider } from './context/DemoContext'
import { demoRoleConfig, type DemoRole } from './crm/auth'
import { CrmSystemPage, type SidebarModuleId, type WorkFilterId } from './pages/CrmSystemPage'
import { KpEditorPage } from './pages/KpEditorPage'
import { loadCrmState, saveCrmState, setCurrentUser } from './crm/demoStore'

type AppSurface = 'crm' | 'kp'
type KpRouteView = 'home' | 'work' | 'history' | 'settings'
type LoginStep = 'idle' | 'typing' | 'loading' | 'splash'
type NavigationMode = 'push' | 'replace'

interface AppNavigationRoute {
  surface: AppSurface
  crmModule: SidebarModuleId
  crmFilter: WorkFilterId
  kpProjectId: string | null
  kpView: KpRouteView
}

interface AuthSession {
  role: DemoRole
}

const authSessionStorageKey = 'uchet-system-auth-session-v1'
const themeStorageKey = 'uchet-system-theme-v1'

const defaultAppRoute: AppNavigationRoute = {
  surface: 'crm',
  crmModule: 'overview',
  crmFilter: 'all',
  kpProjectId: null,
  kpView: 'home',
}

const browserRouteCrmModules = new Set<SidebarModuleId>([
  'overview',
  'projects',
  'counterparties',
  'catalog',
  'analytics',
  'settings',
])
const browserRouteFilters = new Set<WorkFilterId>([
  'all',
  'overdue',
  'due',
  'urgent',
  'withoutQuote',
  'installation',
  'documents',
  'tasks',
  'closed',
])

function resolveBrowserRouteCrmModule(value: string | null): SidebarModuleId {
  return value && browserRouteCrmModules.has(value as SidebarModuleId) ? (value as SidebarModuleId) : 'overview'
}

function resolveBrowserRouteFilter(value: string | null): WorkFilterId {
  return value && browserRouteFilters.has(value as WorkFilterId) ? (value as WorkFilterId) : 'all'
}

function resolveKpRouteView(value: string | null): KpRouteView {
  return value === 'home' || value === 'history' || value === 'settings' ? value : 'work'
}

function readBrowserRoute(): AppNavigationRoute {
  if (typeof window === 'undefined') {
    return defaultAppRoute
  }

  const params = new URLSearchParams(window.location.search)
  const screen = params.get('screen')
  const view = params.get('view')
  const shouldShowKp = screen === 'kp' || (!screen && Boolean(view))

  if (shouldShowKp) {
    return {
      surface: 'kp',
      crmModule: 'overview',
      crmFilter: 'all',
      kpProjectId: params.get('project'),
      kpView: resolveKpRouteView(view),
    }
  }

  const crmModule = resolveBrowserRouteCrmModule(screen)
  return {
    surface: 'crm',
    crmModule,
    crmFilter: crmModule === 'projects' ? resolveBrowserRouteFilter(params.get('filter')) : 'all',
    kpProjectId: null,
    kpView: 'home',
  }
}

function getBrowserRouteUrl(route: AppNavigationRoute) {
  const url = new URL(window.location.href)

  url.searchParams.delete('request')

  if (route.surface === 'kp') {
    url.searchParams.set('screen', 'kp')
    if (route.kpView === 'home') {
      url.searchParams.delete('view')
    } else {
      url.searchParams.set('view', route.kpView)
    }

    if (route.kpProjectId) {
      url.searchParams.set('project', route.kpProjectId)
    } else {
      url.searchParams.delete('project')
    }
  } else {
    if (route.crmModule === 'overview') {
      url.searchParams.delete('screen')
    } else {
      url.searchParams.set('screen', route.crmModule)
    }

    if (route.crmModule === 'projects' && route.crmFilter !== 'all') {
      url.searchParams.set('filter', route.crmFilter)
    } else {
      url.searchParams.delete('filter')
    }

    url.searchParams.delete('project')
    url.searchParams.delete('view')
  }

  return `${url.pathname}${url.search}${url.hash}`
}

function writeBrowserRoute(route: AppNavigationRoute, mode: NavigationMode) {
  if (typeof window === 'undefined') {
    return
  }

  const nextUrl = getBrowserRouteUrl(route)
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`

  if (nextUrl === currentUrl) {
    window.history.replaceState(route, '', nextUrl)
    return
  }

  const method = mode === 'replace' ? 'replaceState' : 'pushState'
  window.history[method](route, '', nextUrl)
}

const demoCredentials: Record<DemoRole, { login: string; password: string }> = {
  manager: {
    login: 'manager@uchet.local',
    password: 'manager-demo',
  },
  director: {
    login: 'director@uchet.local',
    password: 'director-demo',
  },
}

const authRoleCards: Array<{
  role: DemoRole
  title: string
  caption: string
  icon: typeof UserRound
}> = [
  {
    role: 'manager',
    title: 'Менеджер',
    caption: 'Проекты, КП и оплаты',
    icon: UserRound,
  },
  {
    role: 'director',
    title: 'Руководитель',
    caption: 'Контроль и аналитика',
    icon: BriefcaseBusiness,
  },
]

function isDemoRole(value: unknown): value is DemoRole {
  return value === 'manager' || value === 'director'
}

function loadStoredAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(authSessionStorageKey)
    const parsed = raw ? JSON.parse(raw) : null

    if (parsed && typeof parsed === 'object' && isDemoRole((parsed as Partial<AuthSession>).role)) {
      return { role: (parsed as AuthSession).role }
    }
  } catch {
    return null
  }

  return null
}

function loadStoredDarkTheme() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(themeStorageKey) === 'dark'
}

function LoginLanding({ onLogin }: { onLogin: (role: DemoRole) => void }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<DemoRole | null>(null)
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loginStep, setLoginStep] = useState<LoginStep>('idle')

  const isBusy = loginStep !== 'idle'

  const startLogin = (role: DemoRole) => {
    if (isBusy) return

    setSelectedRole(role)
    setError('')
    setLoginStep('typing')
  }

  const handleDemoLogin = (role: DemoRole) => {
    const credentials = demoCredentials[role]
    setLogin(credentials.login)
    setPassword(credentials.password)
    startLogin(role)
  }

  const closeAuth = () => {
    if (isBusy) return

    setIsModalOpen(false)
    setSelectedRole(null)
    setLoginStep('idle')
    setError('')
  }

  const handleLandingPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2

    event.currentTarget.style.setProperty('--landing-x', x.toFixed(3))
    event.currentTarget.style.setProperty('--landing-y', y.toFixed(3))
  }

  const handleLandingPointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty('--landing-x', '0')
    event.currentTarget.style.setProperty('--landing-y', '0')
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isBusy) return

    const role = (Object.keys(demoCredentials) as DemoRole[]).find((item) => {
      const credentials = demoCredentials[item]
      return credentials.login === login.trim() && credentials.password === password
    })

    if (!role) {
      setError('Проверьте логин и пароль или используйте быстрый демо-вход.')
      return
    }

    startLogin(role)
  }

  useEffect(() => {
    if (!selectedRole || loginStep === 'idle') return undefined

    if (loginStep === 'typing') {
      const timer = window.setTimeout(() => setLoginStep('loading'), 420)
      return () => window.clearTimeout(timer)
    }

    if (loginStep === 'loading') {
      const timer = window.setTimeout(() => {
        setIsModalOpen(false)
        setLoginStep('splash')
      }, 560)
      return () => window.clearTimeout(timer)
    }

    const timer = window.setTimeout(() => {
      onLogin(selectedRole)
    }, 1180)

    return () => window.clearTimeout(timer)
  }, [loginStep, onLogin, selectedRole])

  return (
    <div
      className="work-landing work-auth-landing"
      onPointerMove={handleLandingPointerMove}
      onPointerLeave={handleLandingPointerLeave}
    >
      <div className="work-auth-ambient" />
      <div className="work-auth-light work-auth-light-a" />
      <div className="work-auth-light work-auth-light-b" />
      <div className="work-auth-wave work-auth-wave-a" />
      <div className="work-auth-wave work-auth-wave-b" />
      <div className="work-auth-ribbon work-auth-ribbon-a" />
      <div className="work-auth-ribbon work-auth-ribbon-b" />
      <div className="work-auth-vignette" />

      <main className="work-auth-stage">
        <motion.section
          className="work-auth-logo-card"
          initial={{ opacity: 0, y: 16, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="work-auth-card-glass" />
          <div className="work-auth-card-scan" />
          <h1>Учетная система</h1>
        </motion.section>

        <motion.button
          type="button"
          className="work-auth-entry-button"
          onClick={() => {
            setIsModalOpen(true)
            setSelectedRole(null)
            setLoginStep('idle')
            setLogin('')
            setPassword('')
            setError('')
          }}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.34, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
          whileTap={{ scale: 0.985 }}
        >
          <span className="work-auth-entry-border" />
          <span className="work-auth-entry-surface" />
          <span className="work-auth-entry-sheen" />
          <span className="work-auth-entry-label">ВХОД</span>
        </motion.button>
      </main>

      <AnimatePresence>
        {isModalOpen ? (
          <motion.div
            className="work-auth-modal-backdrop"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="work-auth-modal-aura" />
            <motion.form
              className="work-auth-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Вход в учетную запись"
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="work-auth-modal-border" />
              <div className="work-auth-modal-inner">
                <div className="work-auth-demo-switch" aria-label="Быстрый демо-вход">
                  {authRoleCards.map((item) => {
                    const Icon = item.icon
                    const active = selectedRole === item.role

                    return (
                      <button
                        key={item.role}
                        type="button"
                        className={active ? 'is-active' : undefined}
                        disabled={isBusy}
                        onClick={() => handleDemoLogin(item.role)}
                      >
                        <span>
                          <Icon size={20} />
                        </span>
                        <b>{item.title}</b>
                        <small>{item.caption}</small>
                      </button>
                    )
                  })}
                </div>

                <div className="work-auth-modal-head">
                  <div>
                    <h2>Вход в учетную запись</h2>
                    <p>Введите логин и пароль или выберите демо-роль сверху.</p>
                  </div>
                  <button
                    type="button"
                    className="work-icon-button work-auth-close"
                    aria-label="Закрыть окно входа"
                    disabled={isBusy}
                    onClick={closeAuth}
                  >
                    <X size={18} />
                  </button>
                </div>

                <label className="work-auth-field">
                  <span>Логин</span>
                  <div>
                    <UserRound size={17} />
                    <input
                      value={login}
                      autoComplete="username"
                      placeholder="Введите логин"
                      readOnly={isBusy}
                      onChange={(event) => {
                        setLogin(event.target.value)
                        setSelectedRole(null)
                        setError('')
                      }}
                    />
                  </div>
                </label>

                <label className="work-auth-field">
                  <span>Пароль</span>
                  <div>
                    <LockKeyhole size={17} />
                    <input
                      value={password}
                      type="password"
                      autoComplete="current-password"
                      placeholder="Введите пароль"
                      readOnly={isBusy}
                      onChange={(event) => {
                        setPassword(event.target.value)
                        setSelectedRole(null)
                        setError('')
                      }}
                    />
                  </div>
                </label>

                <div className="work-auth-action-panel">
                  {loginStep === 'idle' ? (
                    <>
                      {error ? <div className="work-auth-error">{error}</div> : null}
                      <button type="submit" className="work-auth-submit">
                        Войти
                      </button>
                    </>
                  ) : (
                    <div className="work-auth-loading" aria-live="polite">
                      <div className="work-auth-loading-title">
                        <Loader2 size={17} />
                        {loginStep === 'typing' ? 'Вводим логин и пароль' : 'Открываем рабочий экран'}
                      </div>
                      <div className="work-auth-progress" aria-hidden="true">
                        <motion.span
                          initial={{ width: '18%' }}
                          animate={{ width: loginStep === 'typing' ? '58%' : '88%' }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                      <p>
                        {selectedRole ? `Подготовка пространства: ${demoRoleConfig[selectedRole].label}` : 'Подготовка пространства'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.form>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {loginStep === 'splash' ? (
          <motion.div
            className="work-auth-splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="work-auth-ambient" />
            <div className="work-auth-wave work-auth-wave-a" />
            <div className="work-auth-wave work-auth-wave-b" />
            <motion.section
              className="work-auth-splash-card"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.99 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="work-auth-card-scan" />
              <h2>Учетная система</h2>
              <div className="work-auth-progress work-auth-splash-progress" aria-hidden="true">
                <motion.span initial={{ width: '18%' }} animate={{ width: '100%' }} transition={{ duration: 1.05, ease: 'easeOut' }} />
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function App() {
  const [appRoute, setAppRoute] = useState<AppNavigationRoute>(readBrowserRoute)
  const [authSession, setAuthSession] = useState<AuthSession | null>(loadStoredAuthSession)
  const [darkTheme, setDarkTheme] = useState(loadStoredDarkTheme)

  const navigateApp = useCallback((route: AppNavigationRoute, mode: NavigationMode = 'push') => {
    setAppRoute(route)
    writeBrowserRoute(route, mode)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const handlePopState = () => {
      const nextRoute = readBrowserRoute()

      setAppRoute((current) =>
        nextRoute.surface === 'kp'
          ? {
              ...nextRoute,
              crmFilter: current.crmFilter,
              crmModule: current.crmModule,
            }
          : nextRoute,
      )
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (!authSession) {
      window.localStorage.removeItem(authSessionStorageKey)
      return
    }

    const userId = demoRoleConfig[authSession.role].userId
    const nextState = setCurrentUser(loadCrmState(), userId)

    saveCrmState(nextState)
    window.localStorage.setItem(authSessionStorageKey, JSON.stringify(authSession))
  }, [authSession])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(themeStorageKey, darkTheme ? 'dark' : 'light')
    }
  }, [darkTheme])

  const handleLogin = (role: DemoRole) => {
    navigateApp(defaultAppRoute, 'replace')
    setAuthSession({ role })
  }

  const handleLogout = () => {
    navigateApp(defaultAppRoute, 'replace')
    setAuthSession(null)
  }

  const handleCrmRouteChange = (module: SidebarModuleId, filter: WorkFilterId) => {
    navigateApp(
      {
        ...appRoute,
        surface: 'crm',
        crmModule: module,
        crmFilter: filter,
        kpProjectId: null,
        kpView: 'home',
      },
      'push',
    )
  }

  const handleOpenKpEditor = (dealId?: string) => {
    navigateApp(
      {
        ...appRoute,
        surface: 'kp',
        kpProjectId: dealId ?? null,
        kpView: 'work',
      },
      'push',
    )
  }

  return (
    <DemoProvider>
      {!authSession ? (
        <LoginLanding onLogin={handleLogin} />
      ) : (
        <CrmSystemPage
          key={`${appRoute.crmModule}:${appRoute.crmFilter}`}
          authRole={authSession.role}
          darkTheme={darkTheme}
          routeFilter={appRoute.crmFilter}
          routeModule={appRoute.crmModule}
          showKpEditor={appRoute.surface === 'kp'}
          kpEditor={
            appRoute.surface === 'kp' ? (
              <KpEditorPage projectId={appRoute.kpProjectId} darkTheme={darkTheme} embedded />
            ) : null
          }
          onThemeToggle={() => setDarkTheme((current) => !current)}
          onRouteChange={handleCrmRouteChange}
          onLogout={handleLogout}
          onOpenKpEditor={handleOpenKpEditor}
        />
      )}
    </DemoProvider>
  )
}

export default App
