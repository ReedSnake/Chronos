import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { applicationContainer } from '../app/applicationContainer';
import { PageTemplate } from '../components/layout/PageTemplate';
import { useAuth } from '../features/auth/AuthContext';
import { useLocale } from '../i18n/LocaleProvider';
import { getLocalizedApiError } from '../i18n/apiErrors';

const DEFAULT_LINK_SETTINGS = Object.freeze({ role: 'viewer', expiresInMinutes: null });
const DEFAULT_INVITATION_SETTINGS = Object.freeze({ role: 'viewer', emails: '', expiresInMinutes: 43200 });
const DEFAULT_MEMBER_SETTINGS = Object.freeze({ email: '', role: 'viewer' });

function parseInvitationEmails(value) {
  return value.split(/[\s,;]+/).map((email) => email.trim()).filter(Boolean);
}

function calendarRoleLabel(t, role) {
  const key = `calendarRoles.${role}`;
  const translated = t(key);
  return translated === key ? role : translated;
}

function statusLabel(t, status) {
  const key = `statuses.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

export function CalendarsPage() {
  const { status } = useAuth();
  const { localizedPath, t } = useLocale();
  const [calendars, setCalendars] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [countryCode, setCountryCode] = useState('');
  const [timeZone, setTimeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [defaultView, setDefaultView] = useState('month');
  const [defaultEventDurationMinutes, setDefaultEventDurationMinutes] = useState(60);
  const [isMain, setIsMain] = useState(false);
  const [editValues, setEditValues] = useState({});
  const [shareSettings, setShareSettings] = useState({});
  const [inviteSettings, setInviteSettings] = useState({});
  const [shareLinks, setShareLinks] = useState({});
  const [invitations, setInvitations] = useState({});
  const [invitationResults, setInvitationResults] = useState({});
  const [members, setMembers] = useState({});
  const [memberSettings, setMemberSettings] = useState({});
  const [memberRoles, setMemberRoles] = useState({});
  const [shareUrl, setShareUrl] = useState('');
  const [invitationUrl, setInvitationUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function loadCalendars() {
    setLoading(true);
    setError('');
    try {
      const result = await applicationContainer.calendarService.list();
      setCalendars(result.calendars);
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'calendars.loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === 'authenticated') void loadCalendars();
    else if (status !== 'loading') setLoading(false);
  }, [status]);

  async function createCalendar(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const result = await applicationContainer.calendarService.create({
        name: name.trim(), description, color, countryCode: countryCode.trim() || null,
        timeZone, defaultView, defaultEventDurationMinutes, isMain,
      });
      setCalendars((current) => [result.calendar, ...current]);
      setName('');
      setDescription('');
      setCountryCode('');
      setIsMain(false);
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'calendars.createError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function saveCalendar(calendar) {
    const values = { ...(editValues[calendar.id] || {
      name: calendar.name, description: calendar.description, color: calendar.color,
      countryCode: calendar.countryCode || '', timeZone: calendar.timeZone, defaultView: calendar.defaultView,
      defaultEventDurationMinutes: calendar.defaultEventDurationMinutes, isMain: calendar.isMain, isArchived: calendar.isArchived,
    }) };
    if (!calendar.isOwner) delete values.isMain;
    try {
      const result = await applicationContainer.calendarService.update(calendar.id, values);
      setCalendars((current) => current.map((item) => (item.id === calendar.id ? result.calendar : item)));
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'calendars.updateError'));
    }
  }

  async function removeCalendar(calendar) {
    if (!window.confirm(t('calendars.confirmDelete', { name: calendar.name }))) return;
    try {
      await applicationContainer.calendarService.remove(calendar.id);
      setCalendars((current) => current.filter((item) => item.id !== calendar.id));
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'calendars.deleteError'));
    }
  }

  async function createShareLink(calendarId) {
    const settings = shareSettings[calendarId] || DEFAULT_LINK_SETTINGS;
    setError('');
    setShareUrl('');
    try {
      const result = await applicationContainer.calendarService.createShareLink(calendarId, settings);
      setShareUrl(result.shareUrl);
      setShareLinks((current) => ({ ...current, [calendarId]: [result.link, ...(current[calendarId] || [])] }));
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'calendars.shareError'));
    }
  }

  async function loadShareLinks(calendarId) {
    try {
      const result = await applicationContainer.calendarService.listShareLinks(calendarId);
      setShareLinks((current) => ({ ...current, [calendarId]: result.links }));
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'calendars.shareError'));
    }
  }

  async function revokeShareLink(calendarId, linkId) {
    if (!window.confirm(t('calendars.confirmRevokeShare'))) return;
    try {
      await applicationContainer.calendarService.revokeShareLink(calendarId, linkId);
      setShareLinks((current) => ({
        ...current,
        [calendarId]: (current[calendarId] || []).map((link) =>
          link.id === linkId
            ? { ...link, status: 'revoked', revokedAt: new Date().toISOString() }
            : link
        ),
      }));
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'calendars.shareError'));
    }
  }

  async function createInvitations(calendarId) {
    const settings = inviteSettings[calendarId] || DEFAULT_INVITATION_SETTINGS;
    const emails = parseInvitationEmails(settings.emails);
    if (!emails.length) return;
    setInvitationUrl('');
    setInvitationResults((current) => ({ ...current, [calendarId]: [] }));
    try {
      if (emails.length === 1) {
        const result = await applicationContainer.calendarService.createInvitation(calendarId, {
          email: emails[0], role: settings.role, expiresInMinutes: settings.expiresInMinutes,
        });
        setInvitations((current) => ({ ...current, [calendarId]: [result.invitation, ...(current[calendarId] || [])] }));
        setInvitationUrl(result.invitationUrl);
        setInvitationResults((current) => ({ ...current, [calendarId]: [{ email: emails[0], status: 'sent' }] }));
      } else {
        const result = await applicationContainer.calendarService.createBulkInvitations(calendarId, {
          emails, role: settings.role, expiresInMinutes: settings.expiresInMinutes,
        });
        const sentInvitations = result.results.flatMap((item) => (item.invitation ? [item.invitation] : []));
        setInvitations((current) => ({ ...current, [calendarId]: [...sentInvitations, ...(current[calendarId] || [])] }));
        setInvitationResults((current) => ({ ...current, [calendarId]: result.results }));
      }
      setInviteSettings((current) => ({ ...current, [calendarId]: { ...settings, emails: '' } }));
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'calendars.inviteError'));
    }
  }

  async function loadInvitations(calendarId) {
    try {
      const result = await applicationContainer.calendarService.listInvitations(calendarId);
      setInvitations((current) => ({ ...current, [calendarId]: result.invitations }));
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'calendars.inviteError'));
    }
  }

  async function revokeInvitation(calendarId, invitationId) {
    try {
      await applicationContainer.calendarService.revokeInvitation(calendarId, invitationId);
      setInvitations((current) => ({ ...current, [calendarId]: (current[calendarId] || []).filter((invite) => invite.id !== invitationId) }));
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'calendars.inviteError'));
    }
  }

  async function loadMembers(calendarId) {
    try {
      const result = await applicationContainer.calendarService.listMembers(calendarId);
      setMembers((current) => ({ ...current, [calendarId]: result.members }));
      setMemberRoles((current) => ({
        ...current,
        ...Object.fromEntries(result.members.filter((member) => !member.isOwner).map((member) => [member.id, member.role])),
      }));
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'calendars.membersError'));
    }
  }

  async function createMember(calendarId) {
    const settings = memberSettings[calendarId] || DEFAULT_MEMBER_SETTINGS;
    try {
      const result = await applicationContainer.calendarService.createMember(calendarId, settings);
      setMembers((current) => ({ ...current, [calendarId]: [...(current[calendarId] || []), result.member] }));
      setMemberSettings((current) => ({ ...current, [calendarId]: { ...DEFAULT_MEMBER_SETTINGS } }));
      setMemberRoles((current) => ({ ...current, [result.member.id]: result.member.role }));
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'calendars.membersError'));
    }
  }

  async function updateMember(calendarId, member) {
    const role = memberRoles[member.id] || member.role;
    try {
      const result = await applicationContainer.calendarService.updateMember(calendarId, member.id, { role });
      setMembers((current) => ({
        ...current,
        [calendarId]: (current[calendarId] || []).map((item) => (item.id === member.id ? result.member : item)),
      }));
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'calendars.membersError'));
    }
  }

  async function removeMember(calendarId, member) {
    if (!window.confirm(t('calendars.confirmRemoveMember', { email: member.email }))) return;
    try {
      await applicationContainer.calendarService.removeMember(calendarId, member.id);
      setMembers((current) => ({
        ...current,
        [calendarId]: (current[calendarId] || []).filter((item) => item.id !== member.id),
      }));
    } catch (requestError) {
      setError(getLocalizedApiError(requestError, t, 'calendars.membersError'));
    }
  }

  if (status === 'loading' || loading) return <PageTemplate><p role="status">{t('common.loading')}</p></PageTemplate>;
  if (status !== 'authenticated') return <PageTemplate><p>{t('calendars.signInBefore')}<Link to={localizedPath('/login')}>{t('common.signIn')}</Link>{t('calendars.signInAfter')}</p></PageTemplate>;

  return (
    <section className="account-section">
      <h1>{t('calendars.title')}</h1>
      <form className="account-card account-form" onSubmit={createCalendar}>
        <h2>{t('calendars.createTitle')}</h2>
        <label htmlFor="calendar-name">{t('calendars.name')}</label>
        <input id="calendar-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
        <label htmlFor="calendar-color">{t('calendars.color')}</label>
        <input id="calendar-color" type="color" value={color} onChange={(event) => setColor(event.target.value.toUpperCase())} />
        <label htmlFor="calendar-description">{t('calendars.description')}</label>
        <textarea id="calendar-description" value={description} maxLength={2000} onChange={(event) => setDescription(event.target.value)} />
        <label htmlFor="calendar-country">{t('calendars.countryCode')}</label>
        <input id="calendar-country" value={countryCode} maxLength={2} onChange={(event) => setCountryCode(event.target.value.toUpperCase())} />
        <label htmlFor="calendar-time-zone">{t('calendars.timeZone')}</label>
        <input id="calendar-time-zone" value={timeZone} onChange={(event) => setTimeZone(event.target.value)} maxLength={100} required />
        <label htmlFor="calendar-default-view">{t('calendars.defaultView')}</label>
        <select id="calendar-default-view" value={defaultView} onChange={(event) => setDefaultView(event.target.value)}><option value="month">{t('calendars.viewMonth')}</option><option value="agenda">{t('calendars.viewAgenda')}</option></select>
        <label htmlFor="calendar-default-duration">{t('calendars.defaultDuration')}</label>
        <input id="calendar-default-duration" type="number" min="5" max="1440" value={defaultEventDurationMinutes} onChange={(event) => setDefaultEventDurationMinutes(Number(event.target.value))} required />
        <label><input type="checkbox" checked={isMain} onChange={(event) => setIsMain(event.target.checked)} />{t('calendars.isMain')}</label>
        <button type="submit" disabled={submitting}>{submitting ? t('calendars.creating') : t('calendars.create')}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {shareUrl && <section className="account-card"><h2>{t('calendars.shareReady')}</h2><input aria-label={t('calendars.shareReady')} readOnly value={shareUrl} /></section>}
      {invitationUrl && <section className="account-card"><h2>{t('calendars.inviteReady')}</h2><input aria-label={t('calendars.inviteReady')} readOnly value={invitationUrl} /></section>}
      {!calendars.length && <p>{t('calendars.empty')}</p>}
      {calendars.map((calendar) => {
        const canManage = calendar.role === 'owner' || calendar.role === 'admin';
        const canEdit = calendar.role !== 'viewer';
        const edit = editValues[calendar.id] || {
          name: calendar.name, description: calendar.description, color: calendar.color,
          countryCode: calendar.countryCode || '', timeZone: calendar.timeZone, defaultView: calendar.defaultView,
          defaultEventDurationMinutes: calendar.defaultEventDurationMinutes, isMain: calendar.isMain, isArchived: calendar.isArchived,
        };
        const share = shareSettings[calendar.id] || DEFAULT_LINK_SETTINGS;
        const invite = inviteSettings[calendar.id] || DEFAULT_INVITATION_SETTINGS;
        const memberSettingsForCalendar = memberSettings[calendar.id] || DEFAULT_MEMBER_SETTINGS;
        return (
          <section key={calendar.id} className="account-card">
            <h2><span className="calendar-color" style={{ background: calendar.color }} />{calendar.name}</h2>
            <p>{t('calendars.role', { role: calendarRoleLabel(t, calendar.role) })}</p>
            <Link className="back-link" to={localizedPath(`/calendars/view/${calendar.id}`)}>{t('calendars.view')}</Link>
            {canEdit && <div className="account-form">
              <label htmlFor={`edit-name-${calendar.id}`}>{t('calendars.name')}</label>
              <input id={`edit-name-${calendar.id}`} value={edit.name} maxLength={120} onChange={(event) => setEditValues((current) => ({ ...current, [calendar.id]: { ...edit, name: event.target.value } }))} />
              <label htmlFor={`edit-description-${calendar.id}`}>{t('calendars.description')}</label>
              <textarea id={`edit-description-${calendar.id}`} value={edit.description} maxLength={2000} onChange={(event) => setEditValues((current) => ({ ...current, [calendar.id]: { ...edit, description: event.target.value } }))} />
              <label htmlFor={`edit-color-${calendar.id}`}>{t('calendars.color')}</label>
              <input id={`edit-color-${calendar.id}`} type="color" value={edit.color} onChange={(event) => setEditValues((current) => ({ ...current, [calendar.id]: { ...edit, color: event.target.value.toUpperCase() } }))} />
              <label htmlFor={`edit-country-${calendar.id}`}>{t('calendars.countryCode')}</label>
              <input id={`edit-country-${calendar.id}`} value={edit.countryCode} maxLength={2} onChange={(event) => setEditValues((current) => ({ ...current, [calendar.id]: { ...edit, countryCode: event.target.value.toUpperCase() || null } }))} />
              <label htmlFor={`edit-time-zone-${calendar.id}`}>{t('calendars.timeZone')}</label>
              <input id={`edit-time-zone-${calendar.id}`} value={edit.timeZone} maxLength={100} onChange={(event) => setEditValues((current) => ({ ...current, [calendar.id]: { ...edit, timeZone: event.target.value } }))} />
              <label htmlFor={`edit-default-view-${calendar.id}`}>{t('calendars.defaultView')}</label>
              <select id={`edit-default-view-${calendar.id}`} value={edit.defaultView} onChange={(event) => setEditValues((current) => ({ ...current, [calendar.id]: { ...edit, defaultView: event.target.value } }))}><option value="month">{t('calendars.viewMonth')}</option><option value="agenda">{t('calendars.viewAgenda')}</option></select>
              <label htmlFor={`edit-default-duration-${calendar.id}`}>{t('calendars.defaultDuration')}</label>
              <input id={`edit-default-duration-${calendar.id}`} type="number" min="5" max="1440" value={edit.defaultEventDurationMinutes} onChange={(event) => setEditValues((current) => ({ ...current, [calendar.id]: { ...edit, defaultEventDurationMinutes: Number(event.target.value) } }))} />
              <label><input type="checkbox" checked={Boolean(edit.isArchived)} onChange={(event) => setEditValues((current) => ({ ...current, [calendar.id]: { ...edit, isArchived: event.target.checked } }))} />{t('calendars.archived')}</label>
              {calendar.isOwner && <label><input type="checkbox" checked={Boolean(edit.isMain)} onChange={(event) => setEditValues((current) => ({ ...current, [calendar.id]: { ...edit, isMain: event.target.checked } }))} />{t('calendars.isMain')}</label>}
              <button type="button" onClick={() => { void saveCalendar(calendar); }}>{t('calendars.save')}</button>
            </div>}
            {canManage && <button type="button" className="danger-button" onClick={() => { void removeCalendar(calendar); }}>{t('calendars.delete')}</button>}
            {canManage && <div className="account-form">
              <h3>{t('calendars.shareTitle')}</h3>
              <label htmlFor={`share-role-${calendar.id}`}>{t('calendars.shareRole')}</label>
              <select id={`share-role-${calendar.id}`} value={share.role} onChange={(event) => setShareSettings((current) => ({ ...current, [calendar.id]: { ...share, role: event.target.value } }))}>
                <option value="viewer">{t('calendars.viewer')}</option><option value="editor">{t('calendars.editor')}</option><option value="admin">{t('calendars.admin')}</option>
              </select>
              <label htmlFor={`share-expiry-${calendar.id}`}>{t('calendars.shareExpiry')}</label>
              <select id={`share-expiry-${calendar.id}`} value={share.expiresInMinutes === null ? 'permanent' : String(share.expiresInMinutes)}
                onChange={(event) => setShareSettings((current) => ({
                  ...current,
                  [calendar.id]: {
                    ...share,
                    expiresInMinutes: event.target.value === 'permanent' ? null : Number(event.target.value),
                  },
                }))}>
                <option value="permanent">{t('calendars.permanent')}</option>
                <option value="60">{t('durationLabels.oneHour')}</option>
                <option value="1440">{t('durationLabels.oneDay')}</option>
                <option value="43200">{t('durationLabels.thirtyDays')}</option>
              </select>
              <div className="button-row"><button type="button" onClick={() => { void createShareLink(calendar.id); }}>{t('calendars.createShare')}</button><button type="button" onClick={() => { void loadShareLinks(calendar.id); }}>{t('calendars.showShares')}</button></div>
              {(shareLinks[calendar.id] || []).map((link) => (
                <p key={link.id}>
                  {calendarRoleLabel(t, link.role)} · {statusLabel(t, link.status)} · {link.expiresAt ? new Date(link.expiresAt).toLocaleString() : t('calendars.permanent')}
                  {link.status === 'active' && (
                    <button type="button" onClick={() => { void revokeShareLink(calendar.id, link.id); }}>
                      {t('calendars.revoke')}
                    </button>
                  )}
                </p>
              ))}
            </div>}
            {canManage && <div className="account-form">
              <h3>{t('calendars.inviteTitle')}</h3>
              <label htmlFor={`invite-emails-${calendar.id}`}>{t('calendars.inviteEmails')}</label>
              <textarea id={`invite-emails-${calendar.id}`} value={invite.emails} onChange={(event) => setInviteSettings((current) => ({ ...current, [calendar.id]: { ...invite, emails: event.target.value } }))} />
              <label htmlFor={`invite-role-${calendar.id}`}>{t('calendars.shareRole')}</label>
              <select id={`invite-role-${calendar.id}`} value={invite.role} onChange={(event) => setInviteSettings((current) => ({ ...current, [calendar.id]: { ...invite, role: event.target.value } }))}>
                <option value="viewer">{t('calendars.viewer')}</option><option value="editor">{t('calendars.editor')}</option><option value="admin">{t('calendars.admin')}</option>
              </select>
              <label htmlFor={`invite-expiry-${calendar.id}`}>{t('calendars.shareExpiry')}</label>
              <select id={`invite-expiry-${calendar.id}`} value={String(invite.expiresInMinutes)} onChange={(event) => setInviteSettings((current) => ({ ...current, [calendar.id]: { ...invite, expiresInMinutes: Number(event.target.value) } }))}>
                <option value="60">{t('durationLabels.oneHour')}</option><option value="1440">{t('durationLabels.oneDay')}</option><option value="43200">{t('durationLabels.thirtyDays')}</option>
              </select>
              <button type="button" disabled={!invite.emails.trim()} onClick={() => { void createInvitations(calendar.id); }}>{t('calendars.invite')}</button>
              <button type="button" onClick={() => { void loadInvitations(calendar.id); }}>{t('calendars.showInvites')}</button>
              {(invitations[calendar.id] || []).map((item) => <p key={item.id}>{item.email} · {calendarRoleLabel(t, item.role)} · {statusLabel(t, item.status)} {item.status === 'pending' && <button type="button" onClick={() => { void revokeInvitation(calendar.id, item.id); }}>{t('calendars.revoke')}</button>}</p>)}
              {(invitationResults[calendar.id] || []).map((item, index) => <p key={`${item.email}-${index}`}>{item.email} · {t(`calendars.invitationStatus.${item.status}`)}</p>)}
            </div>}
            {canManage && <div className="account-form">
              <h3>{t('calendars.membersTitle')}</h3>
              <label htmlFor={`member-email-${calendar.id}`}>{t('common.email')}</label>
              <input id={`member-email-${calendar.id}`} type="email" value={memberSettingsForCalendar.email} onChange={(event) => setMemberSettings((current) => ({ ...current, [calendar.id]: { ...memberSettingsForCalendar, email: event.target.value } }))} />
              <label htmlFor={`member-role-${calendar.id}`}>{t('calendars.memberRole')}</label>
              <select id={`member-role-${calendar.id}`} value={memberSettingsForCalendar.role} onChange={(event) => setMemberSettings((current) => ({ ...current, [calendar.id]: { ...memberSettingsForCalendar, role: event.target.value } }))}>
                <option value="viewer">{t('calendars.viewer')}</option><option value="editor">{t('calendars.editor')}</option><option value="admin">{t('calendars.admin')}</option>
              </select>
              <div className="button-row"><button type="button" disabled={!memberSettingsForCalendar.email.trim()} onClick={() => { void createMember(calendar.id); }}>{t('calendars.addMember')}</button><button type="button" onClick={() => { void loadMembers(calendar.id); }}>{t('calendars.showMembers')}</button></div>
              {(members[calendar.id] || []).map((member) => (
                <div key={member.id || member.userId} className="button-row">
                  <span>{member.name || member.email} ({member.email || t('calendars.owner')})</span>
                  {member.isOwner ? <span>{t('calendars.owner')}</span> : <>
                    <select aria-label={t('calendars.memberRole')} value={memberRoles[member.id] || member.role} onChange={(event) => setMemberRoles((current) => ({ ...current, [member.id]: event.target.value }))}>
                      <option value="viewer">{t('calendars.viewer')}</option><option value="editor">{t('calendars.editor')}</option><option value="admin">{t('calendars.admin')}</option>
                    </select>
                    <button type="button" onClick={() => { void updateMember(calendar.id, member); }}>{t('calendars.save')}</button>
                    <button type="button" className="danger-button" onClick={() => { void removeMember(calendar.id, member); }}>{t('calendars.removeMember')}</button>
                  </>}
                </div>
              ))}
            </div>}
          </section>
        );
      })}
    </section>
  );
}
