import { useCallback, useEffect, useState } from 'react';
import ruleApi from '../services/ruleApi';

const activities = [
  'Instagram',
  'YouTube',
  'Facebook',
  'X',
  'Netflix',
  'Any Website',
  'Custom Website',
];

const actions = [
  ['blur', 'Blur'],
  ['warning', 'Warning'],
  ['fullscreen_reminder', 'Fullscreen reminder'],
  ['countdown', 'Countdown'],
  ['custom_message', 'Custom message'],
  ['restriction', 'Restriction'],
];

const emptyForm = {
  activity: 'Instagram',
  target: '',
  timeLimit: '30',
  action: 'warning',
  message: '',
  restDuration: '5',
};

function formatAction(action) {
  return actions.find(([value]) => value === action)?.[1] || action;
}

function validateForm(form) {
  const errors = {};
  const timeLimit = Number(form.timeLimit);
  const restDuration = Number(form.restDuration);

  if (!activities.includes(form.activity)) errors.activity = 'Choose a supported app or website.';
  if (form.activity === 'Custom Website') {
    const domain = form.target.trim();
    const validDomain =
      domain.length <= 253 &&
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain);
    if (!validDomain) errors.target = 'Enter a valid domain, such as example.com.';
  }
  if (!Number.isInteger(timeLimit) || timeLimit < 1 || timeLimit > 1440) {
    errors.timeLimit = 'Enter a whole number between 1 and 1440 minutes.';
  }
  if (!actions.some(([value]) => value === form.action)) {
    errors.action = 'Choose a supported intervention.';
  }
  if (!form.message.trim() || form.message.trim().length > 500) {
    errors.message = 'Enter a message of 1 to 500 characters.';
  }
  if (!Number.isInteger(restDuration) || restDuration < 1 || restDuration > 1440) {
    errors.restDuration = 'Enter a whole number between 1 and 1440 minutes.';
  }
  return errors;
}

function fieldClass(invalid) {
  return `mt-1 block w-full rounded-lg border bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 ${
    invalid
      ? 'border-rose-500 focus:ring-rose-400/30'
      : 'border-slate-700 focus:border-cyan-400 focus:ring-cyan-400/20'
  }`;
}

function FieldError({ id, children }) {
  return children ? (
    <p className="mt-1 text-xs text-rose-300" id={id} role="alert">
      {children}
    </p>
  ) : null;
}

function RuleForm({ initialValues, editing, loading, onCancel, onSave }) {
  const [form, setForm] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initialValues);
    setErrors({});
    setRequestError('');
  }, [initialValues]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setRequestError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationErrors = validateForm(form);
    setErrors(validationErrors);
    setRequestError('');
    if (Object.keys(validationErrors).length) return;

    setSaving(true);
    const payload = {
      activity: form.activity,
      timeLimit: Number(form.timeLimit),
      action: form.action,
      message: form.message.trim(),
      restDuration: Number(form.restDuration),
    };
    if (form.activity === 'Custom Website') payload.target = form.target.trim();

    try {
      await onSave(payload);
    } catch (error) {
      setRequestError(error.message || 'Could not save this rule. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      {loading ? (
        <p className="text-sm text-slate-400" role="status">Loading saved rule...</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-200" htmlFor="rule-activity">
                App or website
              </label>
              <select
                className={fieldClass(Boolean(errors.activity))}
                id="rule-activity"
                value={form.activity}
                onChange={(event) => update('activity', event.target.value)}
                aria-invalid={Boolean(errors.activity)}
                aria-describedby={errors.activity ? 'rule-activity-error' : undefined}
                required
              >
                {activities.map((activity) => <option key={activity}>{activity}</option>)}
              </select>
              <FieldError id="rule-activity-error">{errors.activity}</FieldError>
            </div>

            {form.activity === 'Custom Website' && (
              <div>
                <label className="text-sm font-medium text-slate-200" htmlFor="rule-target">
                  Website domain
                </label>
                <input
                  autoComplete="url"
                  className={fieldClass(Boolean(errors.target))}
                  id="rule-target"
                  placeholder="example.com"
                  value={form.target}
                  onChange={(event) => update('target', event.target.value)}
                  aria-invalid={Boolean(errors.target)}
                  aria-describedby={errors.target ? 'rule-target-error' : undefined}
                  required
                />
                <FieldError id="rule-target-error">{errors.target}</FieldError>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-slate-200" htmlFor="rule-time-limit">
                Screen-time limit (minutes)
              </label>
              <input
                className={fieldClass(Boolean(errors.timeLimit))}
                id="rule-time-limit"
                type="number"
                min="1"
                max="1440"
                step="1"
                inputMode="numeric"
                value={form.timeLimit}
                onChange={(event) => update('timeLimit', event.target.value)}
                aria-invalid={Boolean(errors.timeLimit)}
                aria-describedby={errors.timeLimit ? 'rule-time-limit-error' : undefined}
                required
              />
              <FieldError id="rule-time-limit-error">{errors.timeLimit}</FieldError>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-200" htmlFor="rule-action">
                Intervention type
              </label>
              <select
                className={fieldClass(Boolean(errors.action))}
                id="rule-action"
                value={form.action}
                onChange={(event) => update('action', event.target.value)}
                aria-invalid={Boolean(errors.action)}
                aria-describedby={errors.action ? 'rule-action-error' : undefined}
                required
              >
                {actions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <FieldError id="rule-action-error">{errors.action}</FieldError>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-200" htmlFor="rule-rest-duration">
                Rest duration (minutes)
              </label>
              <input
                className={fieldClass(Boolean(errors.restDuration))}
                id="rule-rest-duration"
                type="number"
                min="1"
                max="1440"
                step="1"
                inputMode="numeric"
                value={form.restDuration}
                onChange={(event) => update('restDuration', event.target.value)}
                aria-invalid={Boolean(errors.restDuration)}
                aria-describedby={errors.restDuration ? 'rule-rest-duration-error' : undefined}
                required
              />
              <FieldError id="rule-rest-duration-error">{errors.restDuration}</FieldError>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-200" htmlFor="rule-message">
              Custom message
            </label>
            <textarea
              className={fieldClass(Boolean(errors.message))}
              id="rule-message"
              rows="3"
              maxLength="500"
              value={form.message}
              onChange={(event) => update('message', event.target.value)}
              aria-invalid={Boolean(errors.message)}
              aria-describedby={errors.message ? 'rule-message-error' : 'rule-message-count'}
              required
            />
            <div className="mt-1 flex justify-between gap-2">
              <FieldError id="rule-message-error">{errors.message}</FieldError>
              <span className="ml-auto text-xs text-slate-500" id="rule-message-count">{form.message.length}/500</span>
            </div>
          </div>
        </>
      )}

      {requestError && (
        <p className="rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-200" role="alert">
          {requestError}
        </p>
      )}
      <p className="text-xs text-slate-500">
        Saved rules can power RESTIFY timed sessions and in-app reminders; they do not monitor or block external apps or websites.
      </p>
      <div className="flex flex-wrap justify-end gap-3">
        <button
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-cyan-200"
          disabled={saving || loading}
          type="submit"
        >
          {saving ? 'Saving...' : editing ? 'Save changes' : 'Create rule'}
        </button>
      </div>
    </form>
  );
}

export default function RuleBuilder() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formInitial, setFormInitial] = useState(emptyForm);
  const [editingLoading, setEditingLoading] = useState(false);
  const [pendingId, setPendingId] = useState(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');

  const loadRules = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await ruleApi.list();
      setRules(response.data.rules);
    } catch {
      setLoadError('Could not load your rules. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  function openCreateForm() {
    setEditingId(null);
    setFormInitial(emptyForm);
    setFormOpen(true);
    setNotice('');
    setActionError('');
  }

  async function openEditForm(rule) {
    setEditingId(rule.id);
    setFormOpen(true);
    setEditingLoading(true);
    setNotice('');
    setActionError('');
    try {
      const response = await ruleApi.get(rule.id);
      const saved = response.data.rule;
      setFormInitial({
        activity: saved.activity,
        target: saved.target || '',
        timeLimit: String(saved.timeLimit),
        action: saved.action,
        message: saved.message,
        restDuration: String(saved.restDuration),
      });
    } catch (error) {
      setFormOpen(false);
      setActionError(error.status === 404
        ? 'This rule no longer exists. Refresh the list to see current rules.'
        : 'Could not load this rule for editing. Please retry.');
    } finally {
      setEditingLoading(false);
    }
  }

  async function saveRule(payload) {
    if (editingId) {
      const response = await ruleApi.update(editingId, payload);
      setRules((current) => current.map((rule) => rule.id === editingId ? response.data.rule : rule));
      setNotice('Rule updated successfully.');
    } else {
      const response = await ruleApi.create(payload);
      setRules((current) => [response.data.rule, ...current]);
      setNotice('Rule created successfully.');
    }
    await loadRules();
    setFormOpen(false);
    setEditingId(null);
  }

  async function toggleRule(rule) {
    setPendingId(rule.id);
    setActionError('');
    setNotice('');
    try {
      const response = await ruleApi.toggle(rule.id);
      const savedRule = response.data.rule;
      setRules((current) => current.map((item) => item.id === rule.id ? savedRule : item));
      setNotice(`Rule ${savedRule.enabled ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      setActionError(error.status === 404
        ? 'This rule could not be found. Refresh the list to reconcile it.'
        : 'Could not change this rule’s status. Please retry.');
    } finally {
      setPendingId(null);
    }
  }

  async function deleteRule(rule) {
    if (!window.confirm(`Delete the rule for ${rule.target || rule.activity}? This cannot be undone.`)) return;
    setPendingId(rule.id);
    setActionError('');
    setNotice('');
    try {
      await ruleApi.delete(rule.id);
      setRules((current) => current.filter((item) => item.id !== rule.id));
      setNotice('Rule deleted.');
    } catch (error) {
      setActionError(error.status === 404
        ? 'This rule could not be found. Refresh the list to reconcile it.'
        : 'Could not delete this rule. Please retry.');
    } finally {
      setPendingId(null);
    }
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setEditingLoading(false);
  }

  return (
    <section
      id="rules"
      className="scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-black/10 sm:p-6"
      aria-labelledby="rule-builder-title"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">Personal settings</p>
          <h2 className="mt-2 text-xl font-semibold text-white" id="rule-builder-title">Rule Builder</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Configure your screen-time limits and preferred interventions. Rules are saved to your account; automatic enforcement is not included here.
          </p>
        </div>
        {!formOpen && (
          <button
            className="rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-200"
            onClick={openCreateForm}
            type="button"
          >
            Create rule
          </button>
        )}
      </div>

      {notice && <p className="mb-4 rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200" role="status">{notice}</p>}
      {actionError && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-200" role="alert">
          <span>{actionError}</span>
          <button className="underline hover:text-white" onClick={loadRules} type="button">Refresh rules</button>
        </div>
      )}

      {formOpen && (
        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
          <h3 className="mb-4 text-base font-semibold text-white">{editingId ? 'Edit rule' : 'Create a rule'}</h3>
          <RuleForm
            key={editingId || 'new-rule'}
            initialValues={formInitial}
            editing={Boolean(editingId)}
            loading={editingLoading}
            onCancel={closeForm}
            onSave={saveRule}
          />
        </div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-3" role="status" aria-label="Loading rules">
          <div className="h-16 rounded-xl bg-slate-800" />
          <div className="h-16 rounded-xl bg-slate-800" />
          <span className="sr-only">Loading your rules...</span>
        </div>
      ) : loadError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-900 bg-rose-950/30 px-4 py-3 text-sm text-rose-200" role="alert">
          <span>{loadError}</span>
          <button className="underline hover:text-white" onClick={loadRules} type="button">Retry</button>
        </div>
      ) : rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-8 text-center">
          <h3 className="font-medium text-white">No rules yet</h3>
          <p className="mt-2 text-sm text-slate-400">Create your first rule to save a screen-time limit and intervention preference.</p>
          {!formOpen && (
            <button
              className="mt-4 rounded-lg border border-cyan-500/50 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-400/10 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              onClick={openCreateForm}
              type="button"
            >
              Create your first rule
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Your saved rules">
          {rules.map((rule) => (
            <li className="rounded-xl border border-slate-800 bg-slate-950/50 p-4" key={rule.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-white">{rule.target || rule.activity}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-xs ${rule.enabled ? 'bg-emerald-400/10 text-emerald-200' : 'bg-slate-800 text-slate-300'}`}>
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {rule.activity} · limit {rule.timeLimit} min · {formatAction(rule.action)} · rest {rule.restDuration} min
                  </p>
                  <p className="mt-2 break-words text-sm text-slate-300">{rule.message}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:opacity-50"
                    disabled={pendingId !== null}
                    onClick={() => toggleRule(rule)}
                    type="button"
                  >
                    {pendingId === rule.id ? 'Saving...' : rule.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:opacity-50"
                    disabled={pendingId !== null}
                    onClick={() => openEditForm(rule)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-rose-200 hover:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:opacity-50"
                    disabled={pendingId !== null}
                    onClick={() => deleteRule(rule)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
