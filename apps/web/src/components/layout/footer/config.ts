export const defaultLinkSections: LinkSection[] = [
  {
    name: '关于',
    links: [
      {
        name: '关于本站',
        href: '/about',
      },
      {
        name: '关于此项目',
        href: 'https://github.com/innei/Shiro',
        external: true,
      },
    ],
  },
  {
    name: '更多',
    links: [
      {
        name: '时间线',
        href: '/timeline',
      },
      {
        name: '友链',
        href: '/friends',
      },
    ],
  },
  {
    name: '联系',
    links: [
      {
        name: '发邮件',
        href: 'mailto:zhubinjian06@163.com',
        external: true,
      },
      {
        name: 'GitHub',
        href: 'https://github.com/Thinkya1',
        external: true,
      },
    ],
  },
]

export interface FooterConfig {
  linkSections: LinkSection[]
  otherInfo: OtherInfo
}
