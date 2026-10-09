(function initRestifyRules(root) {
  const appDomains = {
    Instagram: ['instagram.com'],
    YouTube: ['youtube.com', 'youtu.be'],
    Facebook: ['facebook.com', 'fb.com'],
    X: ['x.com', 'twitter.com'],
    Netflix: ['netflix.com'],
  };

  function domainMatches(host, domain) {
    return host === domain || host.endsWith(`.${domain}`);
  }

  function matchesRule(rule, host) {
    if (!rule || !rule.enabled || !host) return false;
    if (rule.activity === 'Any Website') return true;
    if (rule.activity === 'Custom Website') {
      const target = String(rule.target || '').toLowerCase();
      return Boolean(target) && domainMatches(host, target);
    }
    return (appDomains[rule.activity] || []).some((domain) => domainMatches(host, domain));
  }

  function selectRuleForHost(rules, host) {
    if (!Array.isArray(rules) || !host) return null;
    return (
      rules.find((rule) => rule.activity !== 'Any Website' && matchesRule(rule, host)) ||
      rules.find((rule) => rule.activity === 'Any Website' && matchesRule(rule, host)) ||
      null
    );
  }

  const exported = { domainMatches, matchesRule, selectRuleForHost };
  root.RestifyRules = exported;
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
})(globalThis);
