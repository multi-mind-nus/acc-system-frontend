import { createI18n } from 'vue-i18n'

export type AppLocale = 'en' | 'zh-CN'
let savedLocale: string | null = null
try { savedLocale = localStorage.getItem('locale') } catch { /* Browser storage may be blocked. */ }
const initialLocale: AppLocale = savedLocale === 'zh-CN' ? 'zh-CN' : 'en'

const messages = {
  en: {
    app: { name: 'LedgerFlow' },
    auth: {
      signIn: 'Sign in', signOut: 'Sign out', email: 'Email', password: 'Password',
      welcome: 'Sign in to LedgerFlow', hint: 'Use the account provided by your accounting firm.',
      signingIn: 'Signing in…', showPassword: 'Show password', hidePassword: 'Hide password',
      collectionTitle: 'Client document collection',
      collectionDescription: 'Keep invoices, receipts and bank statements together for your accounting team.',
      collectionTypes: 'Invoices · Receipts · Bank statements',
    },
    nav: { workspace: 'Workspace', profile: 'Account', primary: 'Main navigation' },
    home: {
      description: 'Your organisation and account access.',
      accountSettings: 'Account settings',
      membershipsEmptyHint: 'Your client memberships will appear here when an administrator adds you.',
      firm: 'Organisation', name: 'Name', role: 'Your role', timezone: 'Timezone',
      memberships: 'Client memberships', client: 'Client',
      membershipsHint: 'Client accounts you belong to. Staff access is determined by your organisation role and assignments.',
      noClients: 'No client memberships for this account.',
      firmAdmin: 'Firm administrator', accountant: 'Accountant',
      clientAdmin: 'Client administrator', clientSubmitter: 'Client submitter',
    },
    profile: {
      title: 'Account', name: 'Name', currentPassword: 'Current password', newPassword: 'New password',
      passwordHint: 'Use at least 12 characters.', change: 'Change password',
      changing: 'Changing…', changed: 'Password changed. Please sign in again.',
      description: 'Your personal details, preferences and password.',
      languageHint: 'Saved automatically for this browser.',
      identity: 'Personal details', security: 'Password', firm: 'Organisation', access: 'Role',
    },
    appearance: {
      title: 'Appearance & language', theme: 'Colour theme', mode: 'Display mode',
      evergreen: 'Evergreen', slate: 'Slate', blue: 'Blue',
      light: 'Light', dark: 'Dark', auto: 'Use system',
      modeHint: 'Use system follows your device’s light or dark appearance.',
    },
    error: {
      requestId: 'Request ID', copy: 'Copy', copied: 'Copied',
      copyFailed: 'Copy failed. Select the request ID and copy it manually.',
      generic: 'The request could not be completed. Check your connection and try again.',
      status: {
        400: 'Check your input and try again.',
        401: 'Your session has expired. Please sign in again.',
        403: 'You do not have permission to perform this action.',
        404: 'This item is unavailable or you do not have access to it.',
        409: 'This change conflicts with the current data. Refresh and try again.',
        422: 'Some fields are invalid. Check your input and try again.',
        429: 'Too many attempts. Please wait and try again.',
        500: 'An unexpected error occurred. Please try again later.',
        502: 'The service is temporarily unavailable. Please try again later.',
        503: 'The service is temporarily unavailable. Please try again later.',
        504: 'The service took too long to respond. Please try again.',
      },
      codes: {
        INVALID_CREDENTIALS: 'Email or password is incorrect.',
        CURRENT_PASSWORD_INVALID: 'Current password is incorrect.',
        ACCOUNT_UNAVAILABLE: 'This account is unavailable. Contact your administrator.',
        MEMBERSHIP_REQUIRED: 'No active membership was found. Contact your administrator.',
        INVALID_ORIGIN: 'This site is not allowed to make this request. Contact your administrator.',
        INVITATION_INVALID: 'This invitation is invalid or has expired. Request a new invitation.',
        RESET_INVALID: 'This reset link is invalid or has expired. Request a new link.',
        EMAIL_UNAVAILABLE: 'This email cannot be invited. Contact your administrator.',
        MEMBER_EXISTS: 'This person is already a member.',
        SELF_DISABLE_FORBIDDEN: 'You cannot disable your own account.',
        STAFF_MEMBERSHIP_REQUIRED: 'This account is not a staff member.',
        CLIENT_CODE_EXISTS: 'This client code is already in use. Choose another code.',
      },
    },
    common: { language: 'Language', english: 'English', chinese: '简体中文' },
    notFound: {
      title: 'Page not found', back: 'Return to workspace',
      description: 'This page may have moved, or the link may be incorrect. Return to your workspace to continue.',
      guestDescription: 'This page may have moved, or the link may be incorrect. Sign in to open your workspace.',
      help: 'If you followed a link from your firm, ask your administrator to check it.',
    },
  },
  'zh-CN': {
    app: { name: 'LedgerFlow' },
    auth: {
      signIn: '登录', signOut: '退出登录', email: '邮箱', password: '密码',
      welcome: '登录 LedgerFlow', hint: '使用事务所为你创建的账户登录。', signingIn: '正在登录…',
      showPassword: '显示密码', hidePassword: '隐藏密码',
      collectionTitle: '客户资料收集',
      collectionDescription: '集中提交发票、收据和银行对账单，让事务所及时开展记账。',
      collectionTypes: '发票 · 收据 · 银行对账单',
    },
    nav: { workspace: '工作空间', profile: '账户', primary: '主导航' },
    home: {
      description: '查看所属机构与账户权限。',
      accountSettings: '账户设置',
      membershipsEmptyHint: '管理员将你加入客户后，成员关系会显示在这里。',
      firm: '所属机构', name: '名称', role: '你的角色', timezone: '时区',
      memberships: '客户成员关系', client: '客户',
      membershipsHint: '你作为成员加入的客户。员工的访问范围由事务所角色和分配关系决定。',
      noClients: '此账户暂无客户成员关系。',
      firmAdmin: '事务所管理员', accountant: '会计',
      clientAdmin: '客户管理员', clientSubmitter: '资料提交人',
    },
    profile: {
      title: '账户', name: '姓名', currentPassword: '当前密码', newPassword: '新密码',
      passwordHint: '至少使用 12 个字符。', change: '修改密码', changing: '正在修改…',
      changed: '密码已修改，请重新登录。',
      description: '管理个人资料、偏好设置和密码。', identity: '个人资料', security: '密码',
      languageHint: '自动保存到当前浏览器。',
      firm: '所属机构', access: '角色',
    },
    appearance: {
      title: '外观与语言', theme: '主题配色', mode: '显示模式',
      evergreen: '常青绿', slate: '石板灰', blue: '蓝色',
      light: '浅色', dark: '深色', auto: '跟随系统',
      modeHint: '跟随系统会自动使用设备当前的浅色或深色外观。',
    },
    error: {
      requestId: '请求 ID', copy: '复制', copied: '已复制',
      copyFailed: '复制失败，请选中请求 ID 手动复制。',
      generic: '请求未能完成，请检查网络连接后重试。',
      status: {
        400: '请检查填写内容后重试。',
        401: '会话已失效，请重新登录。',
        403: '你没有执行此操作的权限。',
        404: '此内容不可用，或你没有访问权限。',
        409: '本次修改与当前数据冲突，请刷新后重试。',
        422: '部分字段填写有误，请检查后重试。',
        429: '尝试次数过多，请稍后再试。',
        500: '发生意外错误，请稍后重试。',
        502: '服务暂时不可用，请稍后重试。',
        503: '服务暂时不可用，请稍后重试。',
        504: '服务响应超时，请重试。',
      },
      codes: {
        INVALID_CREDENTIALS: '邮箱或密码不正确。',
        CURRENT_PASSWORD_INVALID: '当前密码不正确。',
        ACCOUNT_UNAVAILABLE: '此账户不可用，请联系管理员。',
        MEMBERSHIP_REQUIRED: '未找到有效的成员关系，请联系管理员。',
        INVALID_ORIGIN: '当前站点无权发起此请求，请联系管理员。',
        INVITATION_INVALID: '邀请无效或已过期，请申请新的邀请。',
        RESET_INVALID: '重置链接无效或已过期，请申请新的链接。',
        EMAIL_UNAVAILABLE: '无法邀请此邮箱，请联系管理员。',
        MEMBER_EXISTS: '此用户已经是成员。',
        SELF_DISABLE_FORBIDDEN: '不能停用你自己的账户。',
        STAFF_MEMBERSHIP_REQUIRED: '此账户不是事务所员工。',
        CLIENT_CODE_EXISTS: '客户编码已存在，请使用其他编码。',
      },
    },
    common: { language: '语言', english: 'English', chinese: '简体中文' },
    notFound: {
      title: '页面不存在', back: '返回工作空间',
      description: '页面可能已移动，或链接不正确。返回工作空间继续操作。',
      guestDescription: '页面可能已移动，或链接不正确。登录后进入你的工作空间。',
      help: '如果链接由事务所提供，请联系管理员确认。',
    },
  },
}

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: 'en',
  messages,
})

export function setLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
  try { localStorage.setItem('locale', locale) } catch { /* Keep language usable without storage. */ }
  document.documentElement.lang = locale
}

document.documentElement.lang = initialLocale
