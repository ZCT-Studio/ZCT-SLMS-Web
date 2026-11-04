// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 ZCT Studio

import {AccountRoleTabs, ApplicationSummary, LoginFrame, LoginMethodTabs, Stat, WorkspaceBrand} from "../ProductUI";
import {Dialog} from "../Dialog";
import {MobileNavigation} from "../Navigation";
import "../styles/FormControls.css";
import "../styles/Portal.css";
import "../styles/Identity.css";
import "../styles/Security.css";
import "../styles/AppDetails.css";
import React, {useState} from "react";
import {createRoot} from "react-dom/client";
import {HashRouter, NavLink, Route, Routes, useParams} from "react-router-dom";
import {
    ArrowLeft,
    Boxes,
    Chrome,
    Github,
    Gitlab,
    Grid2X2,
    KeyRound,
    LayoutDashboard,
    MessageCircle,
    MessagesSquare,
    Plus,
    RefreshCw,
    Search,
    Send,
    Settings,
    ShieldCheck,
    Ticket,
    Users
} from "lucide-react";
import {motion} from "motion/react";
import {Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis} from "recharts";
import {ResponsiveTable} from "../ResponsiveTable";
import "../styles/style.css";
import "../styles/Unified.css";
import "./demo.css";

const nav = [['/', '概览', LayoutDashboard], ['/apps', '应用管理', Boxes], ['/licenses', '卡密管理', KeyRound], ['/users', '用户列表', Users], ['/tickets', '工单系统', MessagesSquare], ['/review', '内容审查', ShieldCheck], ['/vouchers', '兑换码', Ticket], ['/security', '安全设置', ShieldCheck], ['/policies', '平台设置', Settings]] as const;
const initialApps = [{
    id: 'DEMO-APP-001',
    name: '星河笔记',
    description: '用于展示应用管理布局的虚构笔记软件。',
    owner: '演示用户'
}, {
    id: 'DEMO-APP-002',
    name: '云端画板',
    description: '用于展示授权配置的虚构设计工具。',
    owner: '演示团队'
}, {id: 'DEMO-APP-003', name: '轻量工具箱', description: '所有记录均为本地虚拟数据。', owner: '演示用户'}];
const initialTickets = [{
    id: 'DEMO-T-001',
    title: '了解如何配置应用',
    kind: '常规支持',
    status: '待处理',
    priority: '高'
}, {id: 'DEMO-T-002', title: '账号资料展示建议', kind: '账号支持', status: '待处理', priority: '中'}, {
    id: 'DEMO-T-003',
    title: '演示布局反馈',
    kind: '常规支持',
    status: '已处理',
    priority: '低'
}];

function Demo({initialRole, onLoginPage}: { initialRole: string; onLoginPage: () => void }) {
    const [open, setOpen] = useState(false), [role, setRole] = useState(initialRole), [apps, setApps] = useState(initialApps), [tickets, setTickets] = useState(initialTickets), [query, setQuery] = useState(''), [tab, setTab] = useState('邀请码'), [notice, setNotice] = useState(''), [modal, setModal] = useState(false), [current, setCurrent] = useState(''), [accountMenu, setAccountMenu] = useState(false), [settings, setSettings] = useState<Record<string, boolean>>({});
    const notify = (text = '仅更新当前页面的演示状态；刷新后恢复') => setNotice(text);
    const rows = (items: string[][]) => items.filter(row => row.join(' ').toLowerCase().includes(query.toLowerCase()));

    function Table({headers, data}: { headers: string[]; data: React.ReactNode[][] }) {
        return <div className="panel"><ResponsiveTable>
            <thead>
            <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>{data.map((r, i) => <tr key={i}>{r.map((v, n) => <td key={n}>{v}</td>)}</tr>)}{!data.length && <tr>
                <td colSpan={headers.length} className="empty-row">没有匹配的演示记录</td>
            </tr>}</tbody>
        </ResponsiveTable></div>
    }

    function toolbar(title: string, create = false) {
        return <>
            <div className="page-heading portal-list-heading"><h1>{title}</h1>
                <div className="heading-actions">
                    <button className="secondary" onClick={() => notify('虚拟数据已刷新')}><RefreshCw size={15}/>刷新
                    </button>
                    {create && <button className="primary" onClick={() => setModal(true)}><Plus size={15}/>创建演示记录
                    </button>}</div>
            </div>
            <label className="search demo-search"><Search size={16}/><input aria-label="搜索演示记录"
                                                                            placeholder="搜索演示记录" value={query}
                                                                            onChange={e => setQuery(e.target.value)}/></label></>
    }

    function AppDetail() {
        const {id} = useParams();
        const app = apps.find(a => a.id === id);
        return <><NavLink to="/apps" className="back-link"><ArrowLeft size={16}/>返回应用管理</NavLink>
            <h1>{app?.name || '应用详情'}</h1>
            <section className="panel management-card"><h2>应用资料</h2>
                <p>{app?.description}</p>{[['APPID', app?.id], ['所有者昵称', app?.owner], ['APPSECRET', '演示模式不生成或展示真实密钥'], ['编码模式', '无'], ['绑定模式', '设备和 IP'], ['请求签名', '开启'], ['应用状态', '启用']].map(([k, v]) =>
                    <div className="setting-row" key={k}><strong>{k}</strong><span>{v}</span></div>)}</section>
            <section className="panel management-card"><h2>应用操作</h2>
                <button className="secondary"
                        onClick={() => notify('纯静态演示不执行密钥、删除或授权操作')}>查看操作说明
                </button>
            </section>
        </>
    }

    const ticketsView = <>{toolbar("工单系统", true)}
        <div className="settings-tabs">{['全部', '待处理', '已处理'].map(v => <button key={v}
                                                                                      className={current === v ? 'active' : ''}
                                                                                      onClick={() => setCurrent(v)}>{v}</button>)}</div>
        <Table headers={['编号', '标题', '类型', '状态', '优先级', '操作']}
               data={tickets.filter(t => !current || current === '全部' || t.status === current).filter(t => t.title.includes(query)).map(t => [t.id, t.title, t.kind, t.status, t.priority,
                   <button className="secondary" onClick={() => {
                       setCurrent(t.id);
                       notify('已打开虚拟工单，仅用于展示')
                   }}>查看</button>])}/>{tickets.some(t => t.id === current) &&
            <section className="panel management-card"><h2>演示对话</h2>
                <article><strong>用户 · 演示用户 @demo_user</strong><p>这是一条虚拟工单消息，不会发送通知。</p></article>
                <textarea aria-label="演示回复" placeholder="可输入虚拟回复，请勿填写个人信息"/>
                <button className="primary" onClick={() => notify('回复只用于演示，不会发送')}>演示回复</button>
            </section>}</>;
    return <div className={`layout nav-left demo-layout ${open ? 'navigation-open' : ''}`}><MobileNavigation open={open}
                                                                                                             setOpen={setOpen}/>
        <aside className="sidebar"><WorkspaceBrand/>
            <nav>{nav.map(([path, label, Icon]) => <NavLink end={path === '/'} key={path} to={path} onClick={() => {
                setQuery('');
                setCurrent('');
                setOpen(false)
            }}><Icon size={18}/>{label}</NavLink>)}</nav>
            <div className="sidebar-bottom">
                <div className="account-menu-wrap">
                    <button className="profile profile-button" aria-expanded={accountMenu}
                            onClick={() => setAccountMenu(!accountMenu)}><span className="avatar">演</span><span
                        className="profile-info"><strong>{role} · 演示账号</strong><small>demo_user</small></span>
                    </button>
                    {accountMenu && <div className="account-menu">
                        <div className="account-menu-list">{['管理员', '用户', '子用户', '支持'].map(r => <button
                            className={r === role ? 'current' : ''} onClick={() => {
                            setRole(r);
                            setAccountMenu(false);
                            notify('已切换演示身份')
                        }} key={r}><span>{r} · 演示账号</span><small>demo_user</small></button>)}</div>
                        <button className="account-menu-action" onClick={onLoginPage}>返回演示登录</button>
                    </div>}</div>
            </div>
        </aside>
        <main>
            <div className="content">
                <div className="demo-banner" role="note"><strong>Demo · 完全静态</strong><span>免登录 · 数据均为虚构 · 不连接后端 · 不提供真实授权服务</span>
                    <button className="secondary" onClick={onLoginPage}>返回演示登录</button>
                </div>
                {notice && <div className="demo-notice" role="status">{notice}
                    <button aria-label="关闭提示" onClick={() => setNotice('')}>×</button>
                </div>}
                <motion.div initial={{opacity: 0, y: 6}} animate={{opacity: 1, y: 0}}><Routes><Route path="/"
                                                                                                     element={<>
                                                                                                         <div
                                                                                                             className="page-heading">
                                                                                                             <h1>概览</h1>
                                                                                                             <button
                                                                                                                 className="secondary"
                                                                                                                 onClick={() => {
                                                                                                                     setApps(initialApps);
                                                                                                                     setTickets(initialTickets);
                                                                                                                     setSettings({});
                                                                                                                     notify('演示数据已重置')
                                                                                                                 }}>重置演示
                                                                                                             </button>
                                                                                                         </div>
                                                                                                         <div
                                                                                                             className="stats">{[['应用', apps.length], ['虚拟卡密', 128], ['待处理工单', tickets.filter(t => t.status === '待处理').length], ['演示余额', 256]].map(([k, v]) =>
                                                                                                             <Stat
                                                                                                                 key={k}
                                                                                                                 icon={
                                                                                                                     <Boxes
                                                                                                                         size={20}/>}
                                                                                                                 label={String(k)}
                                                                                                                 value={Number(v)}
                                                                                                                 hint="当前虚拟数据"
                                                                                                                 color="purple"
                                                                                                                 badge="演示"/>)}</div>
                                                                                                         <section
                                                                                                             className="panel management-card">
                                                                                                             <h2>近七天虚拟验证趋势</h2>
                                                                                                             <div
                                                                                                                 style={{height: 260}}>
                                                                                                                 <ResponsiveContainer><AreaChart
                                                                                                                     data={[12, 25, 19, 37, 28, 49, 56].map((value, i) => ({
                                                                                                                         date: `第${i + 1}天`,
                                                                                                                         value
                                                                                                                     }))}><CartesianGrid
                                                                                                                     strokeDasharray="3 3"/><XAxis
                                                                                                                     dataKey="date"/><Tooltip/><Area
                                                                                                                     dataKey="value"
                                                                                                                     name="虚拟验证次数"
                                                                                                                     stroke="#8575e9"
                                                                                                                     fill="#eeeaff"/></AreaChart></ResponsiveContainer>
                                                                                                             </div>
                                                                                                         </section>
                                                                                                     </>}/><Route
                    path="/apps" element={<>{toolbar("应用管理", true)}
                    <div
                        className="app-browser view-auto">{apps.filter(a => (a.name + a.description).includes(query)).map(a =>
                        <ApplicationSummary key={a.id} href={'#/apps/' + a.id} name={a.name} owner={a.owner}
                                            appid={a.id}/>)}</div>
                </>}/><Route path="/apps/:id" element={<AppDetail/>}/><Route path="/licenses"
                                                                             element={<>{toolbar("卡密管理", true)}<Table
                                                                                 headers={['卡密（虚拟）', '所属应用', '类型', '状态', '绑定设备', 'IP']}
                                                                                 data={rows(Array.from({length: 12}, (_, i) => [`DEMO-NOT-VALID-${String(i + 1).padStart(3, '0')}`, initialApps[i % 3].name, ['日卡', '月卡', '自定义'][i % 3], ['未使用', '已使用', '已封禁', '已过期'][i % 4], i % 2 ? '演示设备' : '未绑定', i % 2 ? '192.0.2.10' : '未绑定']))}/></>}/><Route
                    path="/users" element={<>{toolbar("用户列表", true)}<Table
                    headers={['UID', '用户名', '昵称', '角色', '余额', '状态']}
                    data={rows([['DEMO-U-001', 'demo_user', '演示用户', '用户', '128', '启用'], ['DEMO-U-002', 'demo_team', '演示团队', '用户', '256', '启用'], ['DEMO-S-001', 'demo_support', '演示支持', '支持', '—', '启用']])}/></>}/><Route
                    path="/tickets" element={ticketsView}/><Route path="/review" element={<>{toolbar("内容审查")}
                    <div className="settings-tabs">{['待审查', '已审查', '屏蔽词过滤'].map(v => <button key={v}
                                                                                                        onClick={() => setCurrent(v)}
                                                                                                        className={current === v ? 'active' : ''}>{v}</button>)}</div>
                    <Table headers={['对象', '名称', '内容', '状态']}
                           data={current === '屏蔽词过滤' ? [['示例词库', '演示条目', '仅展示配置布局，不提供内容审核服务', '未启用']] : apps.map(a => ['应用', a.name, a.description, current === '已审查' ? '已审查' : '待审查'])}/></>}/><Route
                    path="/vouchers" element={<>{toolbar("兑换码", true)}
                    <div className="settings-tabs">{['邀请码', '余额码'].map(v => <button
                        className={tab === v ? 'active' : ''} onClick={() => setTab(v)} key={v}>{v}</button>)}</div>
                    <Table headers={['编号', '类型', '余额', '状态', '有效期']}
                           data={rows(Array.from({length: 6}, (_, i) => [`DEMO-NOT-REDEEMABLE-${i + 1}`, tab, '20', i % 2 ? '已使用' : '未使用', '无限']))}/></>}/>{['security', 'policies'].map(path =>
                    <Route key={path} path={'/' + path}
                           element={<>{toolbar(path === 'security' ? '安全设置' : '平台设置')}
                               <section
                                   className="panel management-card">{(path === 'security' ? ['开放用户注册', '邀请码注册', '允许创建子用户', '双重验证', '人机验证'] : ['工单邮件提醒', '允许查看应用密钥', '暂停卡密计时']).map(k =>
                                   <div className="setting-row" key={k}><strong>{k}</strong>
                                       <button role="switch" aria-checked={!!settings[k]} aria-label={k}
                                               className={'toggle-switch ' + (settings[k] ? 'on' : '')}
                                               onClick={() => setSettings(s => ({...s, [k]: !s[k]}))}><i/></button>
                                   </div>)}
                                   <div className="form-actions">
                                       <button className="primary"
                                               onClick={() => notify('配置仅保存在当前页面内存，未提交服务器')}>演示保存
                                       </button>
                                   </div>
                               </section>
                           </>}/>)}<Route path="*"
                                          element={<section className="panel management-card"><h1>演示页面不存在</h1>
                                              <NavLink to="/">返回概览</NavLink></section>}/></Routes></motion.div>
            </div>
            <footer className="fixed-footer">© ZCT-SLMS · 静态 Demo · 所有记录均为虚拟数据</footer>
        </main>
        {modal &&
            <Dialog title="创建演示记录" close={() => setModal(false)}><p>仅在当前页面内存中生成，请勿输入真实信息。</p>
                <form onSubmit={e => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const name = String(f.get('name'));
                    const id = 'DEMO-' + Date.now();
                    setApps(a => [...a, {id, name, description: '临时创建的虚拟应用，刷新后恢复。', owner: '演示用户'}]);
                    setTickets(t => [...t, {id, title: name, kind: '常规支持', status: '待处理', priority: '中'}]);
                    setModal(false);
                    notify('已生成虚拟应用和工单；不会生成真实卡密或兑换码')
                }}><label>演示名称<input name="name" maxLength={40} required defaultValue="新的演示记录"/></label>
                    <div className="form-actions">
                        <button type="button" className="secondary" onClick={() => setModal(false)}>取消</button>
                        <button className="primary">生成虚拟数据</button>
                    </div>
                </form>
            </Dialog>}</div>
}

function DemoEntry() {
    const [signedIn, setSignedIn] = useState(false), [role, setRole] = useState('owner'), [register, setRegister] = useState(false);
    const enter = () => {
        window.location.hash = '/';
        setSignedIn(true)
    };
    const names: Record<string, string> = {owner: '用户', subuser: '子用户', admin: '管理员/支持'};
    if (signedIn) return <Demo initialRole={names[role] || role} onLoginPage={() => setSignedIn(false)}/>;
    return <LoginFrame title={register ? '注册用户账号' : '欢迎回来'}
                       links={<button onClick={() => setRegister(!register)}>{register ? '返回登录' : '注册'}</button>}
                       notice={<p className="demo-login-note">静态 Demo ·
                           点击任意登录方式即可体验，请勿填写真实凭据。</p>}
                       footer="© ZCT-SLMS · 静态 Demo"><AccountRoleTabs value={role} onChange={setRole}/>
        <form onSubmit={e => {
            e.preventDefault();
            enter()
        }}><LoginMethodTabs value="password" onChange={enter}/><label>用户名<input disabled
                                                                                   placeholder="演示账号，无需填写"/></label><label>密码<input
            disabled type="password" placeholder="演示无需密码"/></label>
            <div className="form-actions">
                <button type="submit" className="primary">{register ? '注册并体验' : '登录'}</button>
            </div>
        </form>
        <div className="login-secondary-links">
            <button onClick={enter}>使用验证码</button>
            <button onClick={enter}>忘记密码</button>
        </div>
        <div className="identity-access">
            <div
                className="oauth-actions">{[[Github, 'GitHub'], [Grid2X2, 'Microsoft'], [Chrome, 'Google'], [Send, 'Telegram'], [Gitlab, 'GitLab'], [MessageCircle, 'Discord']].map(([Icon, name]) => {
                const Glyph = Icon as typeof Github;
                return <button type="button" className="secondary oauth-icon" title={`${name} · 演示免登录`}
                               aria-label={`${name} · 演示免登录`} key={String(name)} onClick={enter}><Glyph size={22}/>
                </button>
            })}</div>
        </div>
        <p className="demo-login-note">不连接第三方服务，不创建真实账号。</p></LoginFrame>;
}

createRoot(document.getElementById('root')!).render(
    <React.StrictMode><HashRouter><DemoEntry/></HashRouter></React.StrictMode>);
