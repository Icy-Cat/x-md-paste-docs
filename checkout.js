(() => {
  const PAY_ORIGIN = 'https://xmdpaste-pay.icy-cat.com';
  const PUBLISHABLE_KEY = 'pk_live_51ULE8lCrOXOxvNDqN7G9xsMqio4b33YHjfWLdLSYPg29tsdr3KifLgZLaw2LZfdDjMap3xaApjGDDHqRPEnZIGN0001vKtPnZd';
  const dialog = document.getElementById('pay-dialog');
  const mount = document.getElementById('stripe-checkout');
  const status = document.getElementById('pay-status');
  if (!dialog || !mount || !status) return;

  const zh = document.documentElement.lang.startsWith('zh');
  let stripePromise;
  let checkout;
  let sessionId = '';

  const getStripe = () => {
    if (window.Stripe) return Promise.resolve(window.Stripe(PUBLISHABLE_KEY));
    if (!stripePromise) {
      stripePromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/endive/stripe.js';
        script.onload = () => resolve(window.Stripe(PUBLISHABLE_KEY));
        script.onerror = () => reject(new Error(zh ? 'Stripe 无法加载，请检查网络后重试。' : 'Stripe could not load. Check your connection and try again.'));
        document.head.append(script);
      });
    }
    return stripePromise;
  };

  const reset = () => {
    if (checkout) checkout.destroy();
    checkout = null;
    sessionId = '';
    mount.replaceChildren();
    status.textContent = '';
  };

  const showError = (message) => {
    mount.replaceChildren();
    status.textContent = message || (zh ? '支付暂时无法加载，请稍后重试。' : 'Checkout could not load. Please try again.');
  };

  const showLicense = async (id) => {
    status.textContent = zh ? '正在确认付款…' : 'Confirming payment…';
    const response = await fetch(`${PAY_ORIGIN}/session-status?session_id=${encodeURIComponent(id)}`);
    const result = await response.json();
    if (!response.ok || !result.code) {
      throw new Error(zh ? '付款仍在确认，请稍后重新打开本页。' : 'Payment is still being confirmed. Please reopen this page shortly.');
    }
    if (checkout) checkout.destroy();
    checkout = null;
    mount.replaceChildren();
    status.textContent = '';
    const resultBox = document.createElement('div');
    resultBox.className = 'pay-result';
    const heading = document.createElement('h3');
    heading.textContent = zh ? '付款成功' : 'Payment complete';
    const text = document.createElement('p');
    text.textContent = zh ? '复制激活码，然后在扩展的 License Key 输入框中粘贴并回车。' : 'Copy the key, then paste it into the extension’s License Key field and press Enter.';
    const code = document.createElement('code');
    code.textContent = result.code;
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'ic-btn ic-btn--primary';
    copy.textContent = zh ? '复制激活码' : 'Copy license key';
    copy.addEventListener('click', async () => {
      await navigator.clipboard.writeText(result.code);
      copy.textContent = zh ? '已复制' : 'Copied';
    });
    resultBox.append(heading, text, code, copy);
    mount.append(resultBox);
  };

  const openCheckout = async (plan) => {
    reset();
    if (!dialog.open) dialog.showModal();
    status.textContent = zh ? '正在加载安全付款表单…' : 'Loading secure checkout…';
    try {
      const stripe = await getStripe();
      checkout = await stripe.createEmbeddedCheckoutPage({
        fetchClientSecret: async () => {
          const response = await fetch(`${PAY_ORIGIN}/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan, locale: zh ? 'zh' : 'en' }),
          });
          const result = await response.json();
          if (!response.ok || !result.clientSecret) throw new Error(result.error);
          sessionId = result.sessionId;
          return result.clientSecret;
        },
        onComplete: () => showLicense(sessionId).catch((error) => showError(error.message)),
      });
      status.textContent = '';
      checkout.mount('#stripe-checkout');
    } catch (error) {
      showError(error.message);
    }
  };

  document.querySelectorAll('[data-checkout-plan]').forEach((button) => {
    button.addEventListener('click', () => openCheckout(button.dataset.checkoutPlan));
  });
  dialog.querySelector('.pay-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', reset);

  const returnedSession = new URLSearchParams(location.search).get('session_id');
  if (returnedSession) {
    dialog.showModal();
    showLicense(returnedSession).catch((error) => showError(error.message));
    history.replaceState({}, '', location.pathname + location.hash);
  }
})();
