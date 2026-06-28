/* 仅允许天气列表区域滑动，其他区域禁止滑动 */
document.addEventListener(
  "touchmove",
  (e) => {
    const target = e.target;
    if (
      target.closest(".hourly-list") ||
      target.closest(".daily-list") ||
      target.closest("dialog")
    ) {
      return;
    }
    e.preventDefault();
  },
  { passive: false }
);

const locationButton = document.querySelector("#locationButton");
const cityDialog = document.querySelector("#cityDialog");
const cityForm = document.querySelector("#cityForm");
const cityInput = document.querySelector("#cityInput");
const citySuggestions = document.querySelector("#citySuggestions");
const closeCityDialog = document.querySelector("#closeCityDialog");
const hourlyPanel = document.querySelector("#hourlyPanel");
const hourlyList = document.querySelector("#hourlyList");
const dailyPanel = document.querySelector("#dailyPanel");
const dailyList = document.querySelector("#dailyList");
const hourlyTemplate = document.querySelector("#hourlyTemplate");
const dailyTemplate = document.querySelector("#dailyTemplate");

const weatherCodeMap = {
  0: ["晴", "☀️"],
  1: ["多云", "🌤️"],
  2: ["多云", "⛅"],
  3: ["阴", "☁️"],
  45: ["雾", "🌫️"],
  48: ["雾", "🌫️"],
  51: ["小雨", "🌦️"],
  53: ["小雨", "🌦️"],
  55: ["中雨", "🌧️"],
  56: ["冻雨", "🌧️"],
  57: ["冻雨", "🌧️"],
  61: ["小雨", "🌧️"],
  63: ["中雨", "🌧️"],
  65: ["大雨", "🌧️"],
  66: ["冻雨", "🌧️"],
  67: ["冻雨", "🌧️"],
  71: ["小雪", "🌨️"],
  73: ["中雪", "🌨️"],
  75: ["大雪", "❄️"],
  77: ["雪", "❄️"],
  80: ["阵雨", "🌦️"],
  81: ["中雨", "🌧️"],
  82: ["暴雨", "⛈️"],
  85: ["阵雪", "🌨️"],
  86: ["大雪", "❄️"],
  95: ["雷暴", "⛈️"],
  96: ["雷暴", "⛈️"],
  99: ["雷暴", "⛈️"],
};

const defaultLocation = {
  latitude: 31.2304,
  longitude: 121.4737,
  name: "黄浦区",
  admin1: "上海市",
  admin3: "黄浦区",
};

const savedLocationKey = "qingyu-weather-location";

const cityLibrary = (window.CITY_LIBRARY || []).map(([name, admin1, admin2, admin3, latitude, longitude, keywords = ""]) => {
  const searchText = normalizeLocationKey(`${name}${admin1}${admin2}${admin3}${keywords}`);
  return {
    key: normalizeLocationKey(name),
    searchText,
    latitude,
    longitude,
    name,
    admin1,
    admin2,
    admin3,
  };
});

let suggestionTimer = null;
let suggestionRequestId = 0;
let activeSuggestions = [];

locationButton.addEventListener("click", () => {
  cityInput.value = "";
  renderCitySuggestions([]);
  cityDialog.showModal();
  cityInput.focus();
});

closeCityDialog.addEventListener("click", () => {
  cityDialog.close();
});

cityForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (activeSuggestions.length > 0) {
    await chooseLocation(activeSuggestions[0]);
    return;
  }

  await chooseCity(cityInput.value);
});

cityInput.addEventListener("input", () => {
  window.clearTimeout(suggestionTimer);
  const keyword = cityInput.value.trim();

  if (!keyword) {
    renderCitySuggestions([]);
    return;
  }

  const localSuggestions = getCommonLocationSuggestions(keyword);
  if (localSuggestions.length > 0) {
    renderCitySuggestions(localSuggestions);
  }

  suggestionTimer = window.setTimeout(async () => {
    const requestId = ++suggestionRequestId;
    const suggestions = await getLocationSuggestions(keyword);

    if (requestId === suggestionRequestId) {
      renderCitySuggestions(suggestions);
    }
  }, 250);
});

citySuggestions.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-suggestion-index]");
  if (!button) return;

  const location = activeSuggestions[Number(button.dataset.suggestionIndex)];
  if (location) {
    await chooseLocation(location);
  }
});

document.querySelectorAll("[data-city]").forEach((button) => {
  button.addEventListener("click", async () => {
    await chooseCity(button.dataset.city);
  });
});

async function chooseCity(city) {
  if (!city) {
    return;
  }

  const updated = await loadWeatherByCity(city.trim(), true);
  if (updated) {
    cityDialog.close();
  }
}

async function chooseLocation(location) {
  setStatus("设置中...");
  const updated = await loadWeather(location.latitude, location.longitude, location.name, location);
  if (updated) {
    saveSelectedLocation(location);
    cityDialog.close();
  }
}

async function loadWeatherByCity(city, shouldSave = false) {
  try {
    setStatus("设置中...");
    const location = await getLocation(city);
    const updated = await loadWeather(location.latitude, location.longitude, location.name, location);
    if (updated && shouldSave) {
      saveSelectedLocation(location);
    }
    return updated;
  } catch (error) {
    setStatus(error.message || "设置失败，请重试");
    return false;
  }
}

async function getLocationSuggestions(city) {
  const localSuggestions = getCommonLocationSuggestions(city);
  const queries = buildSearchQueries(city).slice(0, 2);
  const remoteSuggestions = [];

  for (const query of queries) {
    const openMeteoResults = await searchOpenMeteoLocations(query);
    remoteSuggestions.push(...openMeteoResults);

    if (remoteSuggestions.length >= 8) {
      break;
    }
  }

  if (remoteSuggestions.length < 5) {
    for (const query of queries) {
      const osmResults = await searchOsmLocations(query);
      remoteSuggestions.push(...osmResults);

      if (remoteSuggestions.length >= 8) {
        break;
      }
    }
  }

  return uniqueLocations([...localSuggestions, ...remoteSuggestions]).slice(0, 8);
}

async function getLocation(city) {
  const localLocation = getCommonLocation(city);
  if (localLocation) {
    return localLocation;
  }

  const queries = buildSearchQueries(city);

  for (const query of queries) {
    const location = await searchOpenMeteoLocation(query);
    if (location) {
      return location;
    }
  }

  for (const query of queries) {
    const location = await searchOsmLocation(query);
    if (location) {
      return location;
    }
  }

  throw new Error("没有找到这个位置，请换个城市名或加上省市试试。");
}

async function searchOpenMeteoLocation(city) {
  const results = await searchOpenMeteoLocations(city);
  return results[0] || null;
}

async function searchOpenMeteoLocations(city) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({
    name: city,
    count: "5",
    language: "zh",
    format: "json",
  });

  const response = await fetch(url);
  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  if (!data.results?.length) {
    return [];
  }

  return data.results
    .filter((item) => item.country_code === "CN" || item.country === "中国")
    .map((item) => ({
      latitude: item.latitude,
      longitude: item.longitude,
      name: item.name,
      admin1: item.admin1,
      admin2: item.admin2,
      admin3: item.admin3,
    }));
}

async function searchOsmLocation(city) {
  const results = await searchOsmLocations(city);
  return results[0] || null;
}

async function searchOsmLocations(city) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    q: city,
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
    "accept-language": "zh-CN",
  });

  const response = await fetch(url);
  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data
    .filter((item) => item.address?.country_code === "cn")
    .map((item) => {
      const address = item.address || {};
      return {
        latitude: Number(item.lat),
        longitude: Number(item.lon),
        name: address.city || address.town || address.county || address.suburb || item.name || city,
        admin1: address.state,
        admin2: address.city || address.town,
        admin3: address.city_district || address.suburb || address.county,
      };
    });
}

function getCommonLocation(city) {
  const key = normalizeLocationKey(city);
  const compact = city.trim().replace(/\s+/g, "");
  return cityLibrary.find((location) => (
    location.key === key || compact.includes(location.name) || location.searchText.includes(key)
  )) || null;
}

function getCommonLocationSuggestions(city) {
  const key = normalizeLocationKey(city);
  const compact = city.trim().replace(/\s+/g, "");

  return cityLibrary.filter((location) => (
    location.key.includes(key)
    || key.includes(location.key)
    || compact.includes(location.name)
    || location.name.includes(compact)
    || location.searchText.includes(key)
  ));
}

function uniqueLocations(locations) {
  const seen = new Set();
  return locations.filter((location) => {
    const label = formatLocationName(location.name, location);
    const key = `${label}-${Number(location.latitude).toFixed(2)}-${Number(location.longitude).toFixed(2)}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function renderCitySuggestions(suggestions) {
  activeSuggestions = suggestions;
  citySuggestions.innerHTML = "";
  citySuggestions.hidden = suggestions.length === 0;

  suggestions.forEach((location, index) => {
    const button = document.createElement("button");
    button.className = "city-suggestion";
    button.type = "button";
    button.dataset.suggestionIndex = String(index);

    const title = document.createElement("strong");
    title.textContent = location.name;

    const subtitle = document.createElement("span");
    subtitle.textContent = formatLocationName(location.name, location);

    button.append(title, subtitle);
    citySuggestions.appendChild(button);
  });
}

function buildSearchQueries(city) {
  const cleaned = city.trim().replace(/\s+/g, "");
  const withoutSuffix = cleaned.replace(/(省|市|区|县|自治县|新区|特别行政区)$/u, "");
  const queries = [
    cleaned,
    `${cleaned} 中国`,
    withoutSuffix,
    `${withoutSuffix} 中国`,
    `${withoutSuffix}市`,
    `${withoutSuffix}市 中国`,
  ].filter(Boolean);

  return [...new Set(queries)];
}

function normalizeLocationKey(value) {
  return value
    .trim()
    .replace(/\s+/g, "")
    .replace(/(省|市|区|县|自治县|特别行政区)$/u, "");
}

async function loadWeather(latitude, longitude, displayName, location = {}) {
  try {
    setStatus("正在获取天气数据...");

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
      hourly: "temperature_2m,weather_code,precipitation_probability,wind_speed_10m",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      timezone: "auto",
      forecast_days: "8",
    });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("天气服务暂时不可用。");
    }

    const data = await response.json();
    renderCurrentWeather(data, displayName, location);
    renderHourlyForecast(data.hourly, data.current.time);
    renderDailyForecast(data.daily);
    setStatus("位置设置");
    return true;
  } catch (error) {
    setStatus(error.message || "天气加载失败");
    return false;
  }
}

function saveSelectedLocation(location) {
  try {
    const savedLocation = {
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      name: location.name,
      admin1: location.admin1,
      admin2: location.admin2,
      admin3: location.admin3,
    };

    localStorage.setItem(savedLocationKey, JSON.stringify(savedLocation));
  } catch (error) {
    console.warn("保存位置失败", error);
  }
}

function getSavedLocation() {
  try {
    const raw = localStorage.getItem(savedLocationKey);
    if (!raw) return null;

    const location = JSON.parse(raw);
    if (!Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) {
      return null;
    }

    return {
      ...location,
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      name: location.name || defaultLocation.name,
    };
  } catch (error) {
    return null;
  }
}

function renderCurrentWeather(data, displayName, location) {
  const cityLabel = formatLocationName(displayName, location);

  document.querySelector("#cityName").textContent = cityLabel || displayName;
}

function renderHourlyForecast(hourly, currentTime) {
  hourlyList.innerHTML = "";

  const startIndex = Math.max(
    0,
    hourly.time.findIndex((time) => new Date(time) >= new Date(currentTime))
  );

  hourly.time.slice(startIndex, startIndex + 24).forEach((time, offset) => {
    const index = startIndex + offset;
    const card = hourlyTemplate.content.cloneNode(true);
    const [description, icon] = getWeatherInfo(hourly.weather_code[index]);
    const temperature = Math.round(hourly.temperature_2m[index]);
    const rain = hourly.precipitation_probability?.[index] ?? 0;
    const wind = Math.round(hourly.wind_speed_10m[index]);

    card.querySelector(".hourly-time").textContent = formatHour(time, offset);
    card.querySelector(".hourly-icon").textContent = icon;
    card.querySelector(".hourly-temp").textContent = `${temperature}°C`;
    card.querySelector(".hourly-extra").innerHTML = `${description}`;

    hourlyList.appendChild(card);
  });

  hourlyPanel.hidden = false;
}

function renderDailyForecast(daily) {
  dailyList.innerHTML = "";

  daily.time.slice(1, 8).forEach((date, offset) => {
    const index = offset + 1;
    const card = dailyTemplate.content.cloneNode(true);
    const [description, icon] = getWeatherInfo(daily.weather_code[index]);
    const min = Math.round(daily.temperature_2m_min[index]);
    const max = Math.round(daily.temperature_2m_max[index]);
    const rain = daily.precipitation_probability_max?.[index] ?? 0;

    card.querySelector(".daily-date").textContent = formatDay(date, index);
    card.querySelector(".daily-icon").textContent = icon;
    card.querySelector(".daily-temp").textContent = `${min}°C-${max}°C`;
    card.querySelector(".daily-extra").innerHTML = `${description}`;

    dailyList.appendChild(card);
  });

  dailyPanel.hidden = false;
}

function getWeatherInfo(code) {
  return weatherCodeMap[code] || ["未知天气", "🌡️"];
}

function formatLocationName(displayName, location) {
  const parts = [
    location.admin1,
    location.admin2,
    location.admin3,
    displayName,
  ].filter(Boolean);

  const uniqueParts = [...new Set(parts)];
  return uniqueParts.slice(0, 3).join(" · ");
}

function setStatus(message) {
  locationButton.textContent = message;
}

function formatHour(value, index) {
  const date = new Date(value);
  const hour = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (index === 0) return `现在 ${hour}`;

  const day = new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(date);

  return `${day} ${hour}`;
}

function formatDay(value, index) {
  if (index === 1) return "明天";

  return new Intl.DateTimeFormat("zh-CN", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  }).format(new Date(value));
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

const initialLocation = getSavedLocation() || defaultLocation;
loadWeather(initialLocation.latitude, initialLocation.longitude, initialLocation.name, initialLocation);

/* ── 每 30 分钟自动刷新天气 ── */

setInterval(() => {
  const saved = getSavedLocation() || defaultLocation;
  loadWeather(saved.latitude, saved.longitude, saved.name, saved);
}, 30 * 60 * 1000);

/* ── 反馈 ── */

const feedbackButton = document.querySelector("#feedbackButton");
const feedbackDialog = document.querySelector("#feedbackDialog");
const feedbackForm = document.querySelector("#feedbackForm");
const feedbackInput = document.querySelector("#feedbackInput");
const closeFeedbackDialog = document.querySelector("#closeFeedbackDialog");
const feedbackListDialog = document.querySelector("#feedbackListDialog");
const feedbackList = document.querySelector("#feedbackList");
const closeFeedbackListDialog = document.querySelector("#closeFeedbackListDialog");
const feedbackExport = document.querySelector("#feedbackExport");

const feedbackKey = "qingyu-weather-feedback";
const githubRepo = "8yvmp6vntd-sys/qingyu-weather";

function saveFeedback(text) {
  try {
    const list = JSON.parse(localStorage.getItem(feedbackKey) || "[]");
    list.push({
      text,
      time: new Date().toISOString(),
      ua: navigator.userAgent.slice(0, 120),
    });
    localStorage.setItem(feedbackKey, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
}

function getFeedbackList() {
  try {
    return JSON.parse(localStorage.getItem(feedbackKey) || "[]");
  } catch (e) {
    return [];
  }
}

function renderFeedbackList() {
  const list = getFeedbackList();
  feedbackList.innerHTML = "";

  if (list.length === 0) {
    feedbackList.innerHTML = '<p class="feedback-empty">暂无反馈</p>';
    return;
  }

  list.slice().reverse().forEach((item) => {
    const div = document.createElement("div");
    div.className = "feedback-item";

    const time = new Date(item.time);
    const timeStr = new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(time);

    div.innerHTML = `
      <p class="feedback-item-time">${timeStr}</p>
      <p class="feedback-item-text">${escapeHtml(item.text)}</p>
    `;
    feedbackList.appendChild(div);
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

const workerUrl = "https://qingyu-feedback.your-subdomain.workers.dev"; // ← 部署后替换为实际 Worker URL

async function submitFeedbackToGitHub(text) {
  try {
    if (workerUrl.includes("your-subdomain")) {
      console.warn("Worker URL 未配置，反馈仅保存到本地");
      return false;
    }
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        ua: navigator.userAgent,
      }),
    });
    return response.ok;
  } catch (e) {
    return false;
  }
}

async function fetchGitHubIssues() {
  try {
    const response = await fetch(`https://api.github.com/repos/${githubRepo}/issues?labels=feedback&state=all&per_page=50`, {
      headers: { "Accept": "application/vnd.github+json" },
    });
    if (!response.ok) return [];
    const issues = await response.json();
    return issues.map((issue) => ({
      text: issue.body?.split("**反馈内容：**\\n")[1]?.split("\\n\\n**设备信息：**")[0] || issue.title,
      time: issue.created_at,
      ua: issue.body?.split("**设备信息：**\\n")[1]?.split("\\n\\n**时间：**")[0] || "",
      url: issue.html_url,
    }));
  } catch (e) {
    return [];
  }
}

function showOnlineCount() {
  const count = Math.floor(Math.random() * 50) + 10;
  feedbackDialog.close();
  window.setTimeout(() => {
    alert(`当前在线人数：约 ${count} 人\\n（此为模拟数据，仅供参考）`);
  }, 100);
}

feedbackButton.addEventListener("click", () => {
  feedbackInput.value = "";
  feedbackDialog.showModal();
});

closeFeedbackDialog.addEventListener("click", () => {
  feedbackDialog.close();
});

feedbackForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = feedbackInput.value.trim();
  if (!text) return;

  if (text === "查看反馈") {
    feedbackDialog.close();
    const issues = await fetchGitHubIssues();
    if (issues.length > 0) {
      feedbackList.innerHTML = "";
      issues.forEach((item) => {
        const div = document.createElement("div");
        div.className = "feedback-item";
        const time = new Date(item.time);
        const timeStr = new Intl.DateTimeFormat("zh-CN", {
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(time);
        div.innerHTML = `
          <p class="feedback-item-time">${timeStr}</p>
          <p class="feedback-item-text">${escapeHtml(item.text)}</p>
        `;
        feedbackList.appendChild(div);
      });
    } else {
      renderFeedbackList();
    }
    feedbackListDialog.showModal();
    return;
  }

  if (text === "在线人数") {
    showOnlineCount();
    return;
  }

  const saved = saveFeedback(text);
  const githubOk = await submitFeedbackToGitHub(text);

  if (saved || githubOk) {
    feedbackDialog.close();
    window.setTimeout(() => {
      if (githubOk) {
        alert("反馈已提交，感谢你的建议！");
      } else {
        alert("反馈已保存到本地，感谢你的建议！");
      }
    }, 100);
  } else {
    alert("提交失败，请检查网络后重试。");
  }
});

closeFeedbackListDialog.addEventListener("click", () => {
  feedbackListDialog.close();
});

feedbackExport.addEventListener("click", async () => {
  const issues = await fetchGitHubIssues();
  const localList = getFeedbackList();
  const all = [...issues, ...localList];
  if (all.length === 0) {
    alert("暂无反馈可导出");
    return;
  }
  const data = JSON.stringify(all, null, 2);
  navigator.clipboard.writeText(data).then(() => {
    alert(`已复制 ${all.length} 条反馈到剪贴板`);
  }).catch(() => {
    alert(data);
  });
});



/* ── 打赏弹窗 ── */

const donateButton = document.querySelector("#donateButton");
const donateDialog = document.querySelector("#donateDialog");
const closeDonateDialog = document.querySelector("#closeDonateDialog");

donateButton.addEventListener("click", () => {
  donateDialog.showModal();
});

closeDonateDialog.addEventListener("click", () => {
  donateDialog.close();
});

/* ── 更换背景颜色 ── */

const themeButton = document.querySelector("#themeButton");
const themeDialog = document.querySelector("#themeDialog");
const closeThemeDialog = document.querySelector("#closeThemeDialog");
const themeOptions = document.querySelector("#themeOptions");
const themePaySection = document.querySelector("#themePaySection");
const themePayQr = document.querySelector("#themePayQr");
const themePayTip = document.querySelector("#theme-pay-tip");
const themeCodeInput = document.querySelector("#themeCodeInput");
const themeCodeBtn = document.querySelector("#themeCodeBtn");

let pendingTheme = null;

const CODE_KEY = "qingyu-used-codes";

const themeMap = {
  default: {
    bg: "radial-gradient(circle at 18% 12%, rgba(121, 225, 255, 0.28), transparent 28rem), radial-gradient(circle at 82% 18%, rgba(180, 140, 255, 0.22), transparent 26rem), linear-gradient(135deg, #07111f 0%, #102544 52%, #14213d 100%)",
  },
  sunset: {
    bg: "radial-gradient(circle at 18% 12%, rgba(255, 121, 121, 0.28), transparent 28rem), radial-gradient(circle at 82% 18%, rgba(180, 100, 200, 0.22), transparent 26rem), linear-gradient(135deg, #1a0a0a 0%, #3d1421 52%, #4a1942 100%)",
  },
  forest: {
    bg: "radial-gradient(circle at 18% 12%, rgba(121, 255, 150, 0.28), transparent 28rem), radial-gradient(circle at 82% 18%, rgba(100, 200, 140, 0.22), transparent 26rem), linear-gradient(135deg, #0a1a0f 0%, #143d28 52%, #1a4a32 100%)",
  },
  ocean: {
    bg: "radial-gradient(circle at 18% 12%, rgba(100, 180, 255, 0.28), transparent 28rem), radial-gradient(circle at 82% 18%, rgba(80, 140, 220, 0.22), transparent 26rem), linear-gradient(135deg, #0a0f1a 0%, #0d2847 52%, #0e3a5e 100%)",
  },
  aurora: {
    bg: "radial-gradient(circle at 18% 12%, rgba(100, 255, 180, 0.28), transparent 28rem), radial-gradient(circle at 82% 18%, rgba(180, 255, 100, 0.22), transparent 26rem), linear-gradient(135deg, #0f1a0a 0%, #1a3d14 52%, #2d4a1a 100%)",
  },
  rose: {
    bg: "radial-gradient(circle at 18% 12%, rgba(255, 150, 180, 0.28), transparent 28rem), radial-gradient(circle at 82% 18%, rgba(220, 100, 160, 0.22), transparent 26rem), linear-gradient(135deg, #1a0a14 0%, #3d1428 52%, #4a1938 100%)",
  },
};

const themeStorageKey = "qingyu-theme";

function getUnlockedThemes() {
  try {
    const raw = localStorage.getItem(themeStorageKey);
    return raw ? JSON.parse(raw) : ["default"];
  } catch {
    return ["default"];
  }
}

function saveUnlockedThemes(themes) {
  try {
    localStorage.setItem(themeStorageKey, JSON.stringify(themes));
  } catch {}
}

function applyTheme(name) {
  const theme = themeMap[name];
  if (!theme) return;
  document.body.style.background = theme.bg;
  localStorage.setItem("qingyu-active-theme", name);
  themeOptions.querySelectorAll(".theme-option").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === name);
  });
}

// Restore saved theme on load
const savedActiveTheme = localStorage.getItem("qingyu-active-theme");
if (savedActiveTheme && themeMap[savedActiveTheme]) {
  applyTheme(savedActiveTheme);
}

themeButton.addEventListener("click", () => {
  themeDialog.showModal();
  themePaySection.hidden = true;
  themeCodeInput.value = "";
  pendingTheme = null;
  if (themePayTip) themePayTip.textContent = "支付后支付宝会收到密码";
  // Mark unlocked themes
  const unlocked = getUnlockedThemes();
  themeOptions.querySelectorAll(".theme-option").forEach((btn) => {
    const name = btn.dataset.theme;
    btn.classList.toggle("active", name === savedActiveTheme);
    btn.style.opacity = unlocked.includes(name) ? "1" : "0.55";
  });
});

closeThemeDialog.addEventListener("click", () => {
  themeDialog.close();
});

themeOptions.addEventListener("click", (e) => {
  const btn = e.target.closest(".theme-option");
  if (!btn) return;
  const name = btn.dataset.theme;
  const unlocked = getUnlockedThemes();

  if (unlocked.includes(name)) {
    applyTheme(name);
    return;
  }

  // 未解锁，提示用户并展示支付区域
  alert("该主题未解锁，请支付后获取密码");

  pendingTheme = name;
  themePaySection.hidden = false;
  themeCodeInput.value = "";
  if (themePayTip) themePayTip.textContent = "支付后支付宝会收到密码";
});

const THEME_PASSWORD = "1tte1994re";

themeCodeBtn.addEventListener("click", () => {
  const code = themeCodeInput.value.trim();
  if (!code) {
    if (themePayTip) themePayTip.textContent = "请输入解锁密码";
    return;
  }
  if (!pendingTheme) return;

  // Verify fixed password
  if (code !== THEME_PASSWORD) {
    alert("密码错误，请确认后重新输入");
    themeCodeInput.value = "";
    return;
  }

  // Password correct - unlock theme
  try {
    const unlocked = getUnlockedThemes();
    if (!unlocked.includes(pendingTheme)) {
      unlocked.push(pendingTheme);
      saveUnlockedThemes(unlocked);
    }
    applyTheme(pendingTheme);
    if (themePayTip) themePayTip.textContent = "解锁成功！";
    setTimeout(() => { themePaySection.hidden = true; }, 1500);
  } catch (err) {
    if (themePayTip) themePayTip.textContent = "操作失败，请重试";
  }
});
