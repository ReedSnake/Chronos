import { useEffect, useState } from 'react';
import { applicationContainer } from '../../app/applicationContainer';
import { useLocale } from '../../i18n/LocaleProvider';
import { getLocalizedApiError } from '../../i18n/apiErrors';

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

export function CalendarCollaborationPanel({ calendar }) {
  const { t } = useLocale();
  const [shareSettings, setShareSettings] = useState({});
  const [inviteSettings, setInviteSettings] = useState({});
  const [shareLinks, setShareLinks] = useState({});
  const [invitations, setInvitations] = useState({});
  const [invitationResults, setInvitationResults] = useState({});
  const [invitingCalendars, setInvitingCalendars] = useState({});
  const [members, setMembers] = useState({});
  const [memberSettings, setMemberSettings] = useState({});
  const [memberRoles, setMemberRoles] = useState({});
  const [shareUrl, setShareUrl] = useState('');
  const [invitationUrl, setInvitationUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const pendingCalendarIds = Object.entries(invitationResults)
      .filter(([, items]) => items.some((item) => item.status === 'queued'))
      .map(([calendarId]) => calendarId);
    if (!pendingCalendarIds.length) return undefined;

    const timer = window.setInterval(() => {
      for (const calendarId of pendingCalendarIds) {
        void applicationContainer.calendarService.listInvitations(calendarId)
          .then(({ invitations: latest }) => {
            const byId = new Map(latest.map((item) => [item.id, item]));
            setInvitations((current) => ({ ...current, [calendarId]: latest }));
            setInvitationResults((current) => {
              const previous = current[calendarId] || [];
              let changed = false;
              const updated = previous.map((item) => {
                if (item.status !== 'queued' || !item.invitation?.id) return item;
                const invitation = byId.get(item.invitation.id);
                let nextStatus = 'queued';
                if (!invitation || invitation.deliveryStatus === 'failed') {
                  nextStatus = 'failed';
                } else if (invitation.status === 'revoked') {
                  nextStatus = 'cancelled';
                } else if (invitation.deliveryStatus === 'sent' || invitation.status === 'accepted') {
                  nextStatus = 'sent';
                }
                if (nextStatus === item.status) return item;
                changed = true;
                return { ...item, status: nextStatus };
              });
              return changed ? { ...current, [calendarId]: updated } : current;
            });
          })
          .catch(() => { /* Keep polling; a transient network failure is not a delivery failure. */ });
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [invitationResults]);

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
    if (invitingCalendars[calendarId]) return;
    setInvitingCalendars((current) => ({ ...current, [calendarId]: true }));
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
    } finally {
      setInvitingCalendars((current) => ({ ...current, [calendarId]: false }));
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

  const share = shareSettings[calendar.id] || DEFAULT_LINK_SETTINGS;
  const invite = inviteSettings[calendar.id] || DEFAULT_INVITATION_SETTINGS;
  const memberSettingsForCalendar = memberSettings[calendar.id] || DEFAULT_MEMBER_SETTINGS;

  return (
    <>
      {error && <p role="alert">{error}</p>}
      {shareUrl && <section className="account-card"><h3>{t('calendars.shareReady')}</h3><input aria-label={t('calendars.shareReady')} readOnly value={shareUrl} /></section>}
      {invitationUrl && <section className="account-card"><h3>{t('calendars.inviteReady')}</h3><input aria-label={t('calendars.inviteReady')} readOnly value={invitationUrl} /></section>}
            <details className="account-form">
              <summary>{t('calendars.shareTitle')}</summary>
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
            </details>
            <details className="account-form">
              <summary>{t('calendars.inviteTitle')}</summary>
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
              <button type="button" disabled={!invite.emails.trim() || Boolean(invitingCalendars[calendar.id])} onClick={() => { void createInvitations(calendar.id); }}>{invitingCalendars[calendar.id] ? t('common.loading') : t('calendars.invite')}</button>
              <button type="button" onClick={() => { void loadInvitations(calendar.id); }}>{t('calendars.showInvites')}</button>
              {(invitations[calendar.id] || []).map((item) => <p key={item.id}>{item.email} · {calendarRoleLabel(t, item.role)} · {statusLabel(t, item.status)}{item.status === 'pending' && item.deliveryStatus === 'queued' ? ` · ${t('calendars.invitationStatus.queued')}` : item.deliveryStatus === 'failed' ? ` · ${t('calendars.invitationStatus.failed')}` : ''} {item.status === 'pending' && <button type="button" onClick={() => { void revokeInvitation(calendar.id, item.id); }}>{t('calendars.revoke')}</button>}</p>)}
              {(invitationResults[calendar.id] || []).map((item, index) => <p key={`${item.email}-${index}`}>{item.email} · {t(`calendars.invitationStatus.${item.status}`)}</p>)}
            </details>
            <details className="account-form">
              <summary>{t('calendars.membersTitle')}</summary>
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
            </details>
    </>
  );
}
