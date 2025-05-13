(function () {
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }

  function normalize(str) {
    return (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function getConfigFromQuery() {
    const scripts = document.querySelectorAll('script');
    const trackingScript = Array.from(scripts).find(s => s.src && s.src.includes('tracking-script21'));

    if (!trackingScript || !trackingScript.src.includes('?')) {
      console.log('[Tracking] Script not found or query params missing.');
      return {};
    }

    const src = trackingScript.src;
    const queryString = src.substring(src.indexOf('?') + 1);
    const params = new URLSearchParams(queryString);

    const ctaValues = (params.get('ctaValue') || "").split(',').map(s => normalize(s));

    console.log('[Tracking] Configured CTA Values:', ctaValues);

    return {
      facebookPixelId: params.get('facebookPixelId'),
      googleAdsId: params.get('googleAdsId'),
      scroll20ConversionId: params.get('scroll20ConversionId'),
      scroll50ConversionId: params.get('scroll50ConversionId'),
      anyClickConversionId: params.get('anyClickConversionId'),
      ctaClickConversionId: params.get('ctaClickConversionId'),
      ga4MeasurementId: params.get('ga4Id'),
      tiktokPixelId: params.get('tiktokPixelId'),
      linkedinEventId: params.get('linkedinEventId'),
      ctaValues,
      ctaMethod: params.get('ctaMatchMethod')
    };
  }

  const CONFIG = getConfigFromQuery();
  gtag('js', new Date());
  gtag('config', CONFIG.ga4MeasurementId);

  const scrollTracked = { '20': false, '50': false };

  function pixelsReady() {
    return (
      typeof fbq === 'function' ||
      typeof window.gtag === 'function' ||
      typeof ttq === 'function' ||
      typeof lintrk === 'function'
    );
  }

  function getScrollPercent() {
    const doc = document.documentElement;
    const scrollTop = window.pageYOffset || doc.scrollTop;
    const scrollHeight = doc.scrollHeight - doc.clientHeight;
    return Math.round((scrollTop / scrollHeight) * 100);
  }

  function getPayload(eventName, clickedText) {
    const page = window.location.href;
    if (eventName === 'any_cta') {
      return { page, cta_clicked: clickedText.slice(0, 100) };
    }
    return { page };
  }

  function sendToAllPlatforms(eventName, clickedText = '') {
    const payload = getPayload(eventName, clickedText);

    // Facebook Pixel
    if (typeof fbq === 'function' && CONFIG.facebookPixelId) {
      fbq('trackCustom', eventName, payload);
      console.log(`[Tracking] Facebook event: ${eventName}`, payload);
    }

    // GA4
    if (typeof gtag === 'function' && CONFIG.ga4MeasurementId) {
      gtag('event', eventName, payload);
      console.log(`[Tracking] GA4 event: ${eventName}`, payload);
    }

    // TikTok
    if (typeof ttq === 'function' && CONFIG.tiktokPixelId) {
      ttq.track(eventName, payload);
      console.log(`[Tracking] TikTok event: ${eventName}`, payload);
    }

    // Google Ads
    var conversionId = null;
    if (eventName === 'scroll_20') conversionId = CONFIG.scroll20ConversionId;
    if (eventName === 'scroll_50') conversionId = CONFIG.scroll50ConversionId;
    if (eventName === 'any_click') conversionId = CONFIG.anyClickConversionId;
    if (eventName === 'any_cta') conversionId = CONFIG.ctaClickConversionId;

    if (
      typeof gtag === 'function' &&
      CONFIG.googleAdsId &&
      conversionId !== undefined &&
      conversionId !== null &&
      conversionId !== '' &&
      conversionId !== 'undefined' &&
      conversionId !== 'null'
    ) {
      gtag('event', eventName, {
        send_to: CONFIG.googleAdsId + '/' + conversionId
      });
      console.log('[Tracking] Google Ads event: ' + eventName);
    }

    // LinkedIn
    if (typeof lintrk === 'function' && CONFIG.linkedinEventId) {
      if (eventName === 'any_click' || eventName === 'any_cta') {
        lintrk('track', { conversion_id: CONFIG.linkedinEventId });
        console.log(`[Tracking] LinkedIn event: ${eventName}`);
      }
    }
  }

  function handleScroll() {
    const percent = getScrollPercent();

    if (!scrollTracked['20'] && percent >= 20) {
      sendToAllPlatforms('scroll_20');
      scrollTracked['20'] = true;
    }

    if (!scrollTracked['50'] && percent >= 50) {
      sendToAllPlatforms('scroll_50');
      scrollTracked['50'] = true;
    }

    if (scrollTracked['20'] && scrollTracked['50']) {
      window.removeEventListener('scroll', debounceScroll);
    }
  }

  let scrollTimeout = null;
  function debounceScroll() {
    if (scrollTimeout) return;
    scrollTimeout = setTimeout(() => {
      handleScroll();
      scrollTimeout = null;
    }, 200);
  }

  // New function to get matching CTA id-like attribute
  function getMatchingCtaIdFromAttributes(el, allowedValues = [], maxDepth = 5) {
    let depth = 0;
    while (el && el !== document.body && depth < maxDepth) {
      const attrs = el.attributes;
      for (let i = 0; i < attrs.length; i++) {
        const attrName = attrs[i].name;
        const attrValue = normalize(attrs[i].value);
        if (attrName.toLowerCase().includes('id')) {
          if (allowedValues.includes(attrValue)) {
            console.log('[CTA Match] Matched attribute:', attrName, '=', attrValue);
            return attrValue;
          }
        }
      }
      el = el.parentElement;
      depth++;
    }
    return null;
  }

  function handleClick(event) {
    const clickedText = (event.target.textContent || '').trim();
    const normalizedClicked = normalize(clickedText);

    console.log('[Click] Raw Text:', clickedText);
    console.log('[Click] Normalized Text:', normalizedClicked);
    console.log('[Click] Configured CTA Values:', CONFIG.ctaValues);

    sendToAllPlatforms('any_click');

    // CTA Text matching
    if (CONFIG.ctaMethod === 'CTA Text') {
      const matchedCTA = CONFIG.ctaValues.some(text => text === normalizedClicked);
      console.log(`[Click] CTA Text match: ${matchedCTA}`);
      if (matchedCTA) {
        console.log('[Tracking] CTA matched by Text:', clickedText);
        sendToAllPlatforms('any_cta', clickedText);
      } else {
        console.log('[Tracking] CTA Text did NOT match.');
      }
    }

    // CTA Button ID or ID-like matching
    if (CONFIG.ctaMethod === 'CTA Button Id') {
      const clickedElement = event.target;
      const matchedValue = getMatchingCtaIdFromAttributes(
        clickedElement,
        CONFIG.ctaValues // normalize if needed for comparison
      );

      if (matchedValue) {
        console.log('[Tracking] CTA matched by ID-like attribute:', matchedValue);
        sendToAllPlatforms('any_cta', matchedValue);
      } else {
        console.log('[Tracking] CTA ID did NOT match.');
      }
    }
  }

  function initListeners() {
    window.addEventListener('scroll', debounceScroll, { passive: true });
    setTimeout(handleScroll, 1000);
    document.addEventListener('click', handleClick);
  }

  function startTracking() {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      initListeners();
    } else {
      window.addEventListener('DOMContentLoaded', initListeners);
    }
  }

  function waitForPixels() {
    let attempts = 0;
    const interval = setInterval(() => {
      if (pixelsReady()) {
        clearInterval(interval);
        console.log('[Tracking] Pixels detected, starting tracking.');
        startTracking();
      } else if (attempts++ >= 40) {
        clearInterval(interval);
        console.log('[Tracking] Pixels not detected after waiting, starting anyway.');
        startTracking();
      }
    }, 500);
  }

  waitForPixels();
})();
