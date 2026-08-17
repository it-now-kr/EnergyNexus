(function () {
  const cfg = window.ENERGY_NEXUS || {};
  const inIframe = window.self !== window.top;
  document.documentElement.classList.toggle("in-iframe", inIframe);

  const INSIGHTS = [];
  const RSS_CACHE_KEY = "energy-nexus-rss";
  const RSS_CACHE_MS = 5 * 60 * 1000;

  const pending = "준비 중";
  const email = (cfg.email || "").trim();
  const phone = (cfg.phone || "").trim();
  const bizNumber = (cfg.bizNumber || "").trim();
  const address = [cfg.address, cfg.addressDetail].filter(Boolean).join(" ");

  function textOrPending(value) {
    return value || pending;
  }

  function renderContactMeta() {
    const root = document.getElementById("contact-meta");
    if (!root) return;
    const rows = [
      ["이메일", email ? '<a href="mailto:' + email + '">' + email + "</a>" : pending],
      ["대표전화", phone ? '<a href="tel:' + phone.replace(/\s/g, "") + '">' + phone + "</a>" : pending],
      ["본점", address || pending],
    ];
    root.innerHTML = rows
      .map(function (row) {
        return "<div><dt>" + row[0] + "</dt><dd>" + row[1] + "</dd></div>";
      })
      .join("");
  }

  function renderFooter() {
    const legal = document.getElementById("footer-legal");
    if (!legal) return;
    legal.innerHTML = [
      (cfg.company || "㈜에너지넥서스") + "  |  대표이사 " + (cfg.ceo || "김형중"),
      "사업자등록번호  " + textOrPending(bizNumber),
      "본점  " + textOrPending(address),
      "대표전화  " + textOrPending(phone) + "  |  이메일  " + textOrPending(email),
    ].join("<br />");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function decodeEntities(value) {
    const box = document.createElement("textarea");
    box.innerHTML = String(value || "");
    return box.value;
  }

  function stripHtml(value) {
    const box = document.createElement("div");
    box.innerHTML = String(value || "");
    return (box.textContent || "").replace(/\s+/g, " ").trim();
  }

  function excerptFrom(value) {
    const text = stripHtml(decodeEntities(value));
    if (text.length <= 110) return text;
    return text.slice(0, 109).replace(/\s+\S*$/, "") + "…";
  }

  function cleanPostUrl(value) {
    try {
      const url = new URL(String(value || ""), location.href);
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch (err) {
      return String(value || "").split("?")[0];
    }
  }

  function tagFromTitle(title, category) {
    if (/기고/.test(title || "")) return "Column";
    if (category && category !== "에너로그") return category;
    return "Energy Insights";
  }

  function xmlText(node, tag) {
    const el = node.getElementsByTagName(tag)[0];
    return el ? decodeEntities(el.textContent || "") : "";
  }

  function parseRssXml(rssXml) {
    const doc = new DOMParser().parseFromString(rssXml, "text/xml");
    if (doc.querySelector("parsererror")) throw new Error("rss-parse");
    return Array.prototype.slice
      .call(doc.querySelectorAll("item"))
      .slice(0, cfg.rssCount || 3)
      .map(function (item) {
        const title = xmlText(item, "title");
        return {
          tag: tagFromTitle(title, xmlText(item, "category")),
          title: title,
          excerpt: excerptFrom(xmlText(item, "description")),
          url: cleanPostUrl(xmlText(item, "guid") || xmlText(item, "link")),
        };
      })
      .filter(function (item) {
        return item.title && item.url;
      });
  }

  function parseRssJson(data) {
    const items = (data && data.items) || [];
    return items.slice(0, cfg.rssCount || 3).map(function (item) {
      const title = decodeEntities(item.title || "");
      return {
        tag: tagFromTitle(title, (item.categories && item.categories[0]) || ""),
        title: title,
        excerpt: excerptFrom(item.description || item.content || ""),
        url: cleanPostUrl(item.guid || item.link),
      };
    }).filter(function (item) {
      return item.title && item.url;
    });
  }

  function readRssCache() {
    try {
      const raw = sessionStorage.getItem(RSS_CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (!cached || Date.now() - cached.at > RSS_CACHE_MS) return null;
      if (!cached.items || !cached.items.length) return null;
      return cached.items;
    } catch (err) {
      return null;
    }
  }

  function writeRssCache(items) {
    try {
      sessionStorage.setItem(
        RSS_CACHE_KEY,
        JSON.stringify({ at: Date.now(), items: items })
      );
    } catch (err) {
      /* ignore quota / private mode */
    }
  }

  function fetchJson(url) {
    return fetch(url, { credentials: "omit" }).then(function (res) {
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    });
  }

  function fetchText(url) {
    return fetch(url, { credentials: "omit" }).then(function (res) {
      if (!res.ok) throw new Error(String(res.status));
      return res.text();
    });
  }

  function loadInsightsFromRss() {
    const rssUrl = cfg.rssUrl;
    if (!rssUrl) return Promise.resolve([]);

    const cached = readRssCache();
    if (cached) return Promise.resolve(cached);

    const jsonApi =
      "https://api.rss2json.com/v1/api.json?rss_url=" +
      encodeURIComponent(rssUrl) +
      "&count=" +
      encodeURIComponent(cfg.rssCount || 3);
    const proxyApi =
      "https://api.allorigins.win/raw?url=" + encodeURIComponent(rssUrl);

    return fetchJson(jsonApi)
      .then(function (data) {
        if (!data || data.status !== "ok") throw new Error("rss-json");
        return parseRssJson(data);
      })
      .catch(function () {
        return fetchText(proxyApi).then(parseRssXml);
      })
      .catch(function () {
        return fetchText(rssUrl).then(parseRssXml);
      })
      .then(function (items) {
        if (!items.length) throw new Error("rss-empty");
        writeRssCache(items);
        return items;
      });
  }

  function renderInsights(items) {
    const list = document.getElementById("insight-list");
    if (!list) return;
    const posts = items || INSIGHTS;
    if (!posts.length) {
      list.innerHTML =
        '<p class="insight-status">최신 글을 불러오지 못했습니다. <a href="' +
        escapeHtml(cfg.blogUrl || cfg.rssUrl || "#") +
        '" target="_blank" rel="noopener noreferrer">에너로그에서 보기</a></p>';
      return;
    }
    list.innerHTML = posts
      .map(function (item, index) {
        const inner =
          '<span class="tag">' +
          escapeHtml(item.tag) +
          "</span>" +
          "<div><h3>" +
          escapeHtml(item.title) +
          "</h3><p>" +
          escapeHtml(item.excerpt) +
          "</p></div>" +
          '<span class="more">' +
          (item.url ? "원문 보기" : "미리보기") +
          "</span>";
        if (item.url) {
          return (
            '<a class="insight-card" href="' +
            escapeHtml(item.url) +
            '" target="_blank" rel="noopener noreferrer">' +
            inner +
            "</a>"
          );
        }
        return (
          '<button class="insight-card" type="button" data-insight="' +
          index +
          '">' +
          inner +
          "</button>"
        );
      })
      .join("");
  }

  function showInsightLoading() {
    const list = document.getElementById("insight-list");
    if (!list) return;
    list.innerHTML = '<p class="insight-status">최신 글을 불러오는 중입니다.</p>';
  }

  const insightModal = document.getElementById("insight-modal");
  const privacyModal = document.getElementById("privacy-modal");

  function openInsight(index) {
    const item = INSIGHTS[index];
    if (!item || !insightModal) return;
    document.getElementById("insight-modal-tag").textContent = item.tag;
    document.getElementById("insight-modal-title").textContent = item.title;
    document.getElementById("insight-modal-body").textContent = item.excerpt;
    const link = document.getElementById("insight-modal-link");
    if (item.url) {
      link.hidden = false;
      link.href = item.url;
    } else {
      link.hidden = true;
      document.getElementById("insight-modal-body").textContent =
        item.excerpt + " 상세 게시물은 연결 주소가 등록되면 이 화면에서 바로 이동합니다.";
    }
    insightModal.showModal();
  }

  function closeModals() {
    [insightModal, privacyModal].forEach(function (dialog) {
      if (dialog && dialog.open) dialog.close();
    });
  }

  function scrollToHash() {
    const hash = (location.hash || "#home").slice(1);
    if (hash === "privacy") {
      if (privacyModal && !privacyModal.open) privacyModal.showModal();
      return;
    }
    if (privacyModal && privacyModal.open) privacyModal.close();
    const target = document.getElementById(hash) || document.getElementById("home");
    if (!target) return;
    const header = document.querySelector(".site-header");
    const offset = header ? header.offsetHeight + 8 : 0;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function setActiveNav() {
    const sections = ["home", "about", "greeting", "services", "insights", "contact"];
    const headerH = (document.querySelector(".site-header") || {}).offsetHeight || 0;
    let current = "home";
    sections.forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.getBoundingClientRect().top - headerH - 24 <= 0) current = id;
    });
    document.querySelectorAll(".nav a").forEach(function (link) {
      const href = (link.getAttribute("href") || "").slice(1);
      link.classList.toggle("is-active", href === current || (current === "home" && href === "home"));
    });
  }

  function postHeight() {
    if (!inIframe) return;
    const height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    parent.postMessage({ type: "energy-nexus-resize", height: height }, "*");
  }

  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");
  toggle.addEventListener("click", function () {
    const open = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
  });

  nav.addEventListener("click", function (event) {
    if (event.target.closest("a")) {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  document.getElementById("insight-list").addEventListener("click", function (event) {
    const button = event.target.closest("[data-insight]");
    if (!button) return;
    openInsight(Number(button.getAttribute("data-insight")));
  });

  document.querySelectorAll("[data-close]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      closeModals();
      if (location.hash === "#privacy") history.replaceState(null, "", "#contact");
    });
  });

  [insightModal, privacyModal].forEach(function (dialog) {
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) {
        dialog.close();
        if (dialog === privacyModal && location.hash === "#privacy") {
          history.replaceState(null, "", "#contact");
        }
      }
    });
  });

  const form = document.getElementById("contact-form");
  const note = document.getElementById("form-note");
  const submitBtn = form.querySelector('button[type="submit"]');
  let formBusy = false;

  function showFormNote(message, ok) {
    note.hidden = false;
    note.textContent = message;
    note.classList.toggle("is-success", Boolean(ok));
  }

  function clearFieldErrors() {
    form.querySelectorAll(".is-error").forEach(function (el) {
      el.classList.remove("is-error");
    });
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  function validateContactForm() {
    clearFieldErrors();
    const checks = [
      { el: form.elements.name, msg: "이름을 입력해 주세요." },
      {
        el: form.elements.email,
        msg: "이메일을 입력해 주세요.",
        format: isValidEmail,
        formatMsg: "올바른 이메일 주소를 입력해 주세요. 예: name@example.com",
      },
      { el: form.elements.type, msg: "문의 유형을 선택해 주세요." },
      { el: form.elements.message, msg: "문의 내용을 입력해 주세요." },
      { el: form.elements.agree, msg: "개인정보 수집·이용에 동의해 주세요." },
    ];

    for (let i = 0; i < checks.length; i += 1) {
      const field = checks[i];
      const el = field.el;
      if (!el) continue;
      const empty =
        el.type === "checkbox" ? !el.checked : !String(el.value || "").trim();
      const badFormat = !empty && field.format && !field.format(el.value);
      if (!empty && !badFormat) continue;
      el.classList.add("is-error");
      el.focus();
      el.scrollIntoView({ block: "center", inline: "nearest" });
      showFormNote(empty ? field.msg : field.formatMsg || field.msg, false);
      return false;
    }

    note.hidden = true;
    return true;
  }

  function buildGoogleFormBody(data) {
    const fields = cfg.googleFormFields || {};
    const params = new URLSearchParams();
    const payload = {
      name: data.get("name") || "",
      org: data.get("org") || "",
      email: String(data.get("email") || "").trim(),
      phone: data.get("phone") || "",
      type: data.get("type") || "",
      message: data.get("message") || "",
      agree: cfg.googleFormAgreeValue || "",
    };
    Object.keys(payload).forEach(function (key) {
      if (!fields[key]) return;
      params.append(fields[key], payload[key]);
    });
    return params;
  }

  function submitToGoogleForm(data) {
    const params = buildGoogleFormBody(data);
    if (typeof fetch === "function") {
      return fetch(cfg.googleFormAction, {
        method: "POST",
        mode: "no-cors",
        body: params,
      });
    }

    return new Promise(function (resolve) {
      const iframe = document.getElementById("google-form-frame");
      const hidden = document.createElement("form");
      hidden.action = cfg.googleFormAction;
      hidden.method = "POST";
      hidden.target = "google-form-frame";
      hidden.acceptCharset = "UTF-8";
      hidden.setAttribute("aria-hidden", "true");
      hidden.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;opacity:0;";
      params.forEach(function (value, key) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        hidden.appendChild(input);
      });
      let done = false;
      function finish() {
        if (done) return;
        done = true;
        window.setTimeout(function () {
          if (hidden.parentNode) hidden.parentNode.removeChild(hidden);
        }, 400);
        resolve();
      }
      if (iframe) iframe.addEventListener("load", finish, { once: true });
      document.body.appendChild(hidden);
      hidden.submit();
      window.setTimeout(finish, 2000);
    });
  }

  form.addEventListener("input", function (event) {
    const target = event.target;
    if (target && target.classList) target.classList.remove("is-error");
  });
  form.addEventListener("change", function (event) {
    const target = event.target;
    if (target && target.classList) target.classList.remove("is-error");
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (formBusy) return;
    if (!validateContactForm()) return;

    const data = new FormData(form);

    if (cfg.googleFormAction && cfg.googleFormFields) {
      formBusy = true;
      submitBtn.disabled = true;
      showFormNote("문의를 접수하는 중입니다.", true);
      submitToGoogleForm(data)
        .then(function () {
          form.reset();
          clearFieldErrors();
          showFormNote("문의가 접수되었습니다. 내용을 확인한 후 연락드리겠습니다.", true);
        })
        .catch(function () {
          showFormNote("접수가 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.", false);
        })
        .then(function () {
          formBusy = false;
          submitBtn.disabled = false;
          postHeight();
        });
      return;
    }

    if (cfg.googleFormUrl) {
      window.open(cfg.googleFormUrl, "_blank", "noopener");
      return;
    }

    if (!email) {
      showFormNote(
        "대표 이메일이 등록되면 접수가 시작됩니다. assets/config.js의 email 또는 googleFormUrl을 입력해 주세요.",
        false
      );
      return;
    }

    const body = [
      "이름: " + data.get("name"),
      "소속: " + (data.get("org") || "-"),
      "이메일: " + data.get("email"),
      "연락처: " + (data.get("phone") || "-"),
      "유형: " + data.get("type"),
      "",
      data.get("message"),
    ].join("\n");
    const href =
      "mailto:" +
      encodeURIComponent(email) +
      "?subject=" +
      encodeURIComponent("[에너지넥서스 문의] " + data.get("type")) +
      "&body=" +
      encodeURIComponent(body);
    window.location.href = href;
  });

  document.addEventListener("click", function (event) {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.metaKey || event.ctrlKey) return;
    const hash = link.getAttribute("href");
    if (!hash || hash === "#") return;
    event.preventDefault();
    if (location.hash === hash) scrollToHash();
    else location.hash = hash;
  });

  window.addEventListener("hashchange", scrollToHash);
  window.addEventListener("load", function () {
    if (location.hash) scrollToHash();
    postHeight();
  });
  window.addEventListener("scroll", setActiveNav, { passive: true });
  window.addEventListener("resize", postHeight);

  renderContactMeta();
  renderFooter();
  showInsightLoading();
  loadInsightsFromRss()
    .then(function (items) {
      INSIGHTS.length = 0;
      items.forEach(function (item) {
        INSIGHTS.push(item);
      });
      renderInsights(INSIGHTS);
      postHeight();
    })
    .catch(function () {
      renderInsights([]);
      postHeight();
    });
  setActiveNav();
  postHeight();
})();
