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

/* ── 下拉刷新 ── */

const appShell = document.querySelector(".app-shell");
const pullIndicator = document.querySelector("#pullIndicator");

let pullStartY = 0;
let pulling = false;
let pullThreshold = 80;

document.addEventListener("touchstart", (e) => {
  if (window.scrollY > 0) return;
  pullStartY = e.touches[0].clientY;
  pulling = true;
}, { passive: true });

document.addEventListener("touchmove", (e) => {
  if (!pulling || window.scrollY > 0) return;
  const dy = e.touches[0].clientY - pullStartY;
  if (dy > 30) {
    pullIndicator.classList.add("visible");
    appShell.style.transform = `translateY(${Math.min(dy * 0.3, 60)}px)`;
  }
}, { passive: true });

document.addEventListener("touchend", () => {
  if (!pulling) return;
  pulling = false;
  pullIndicator.classList.remove("visible");
  appShell.style.transform = "";

  const dy = Math.abs(pullStartY);
  if (dy > pullThreshold) {
    const saved = getSavedLocation() || defaultLocation;
    loadWeather(saved.latitude, saved.longitude, saved.name, saved);
  }
  pullStartY = 0;
}, { passive: true });

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

feedbackButton.addEventListener("click", () => {
  feedbackInput.value = "";
  feedbackDialog.showModal();
});

closeFeedbackDialog.addEventListener("click", () => {
  feedbackDialog.close();
});

feedbackForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = feedbackInput.value.trim();
  if (!text) return;

  if (text === "查看反馈") {
    feedbackDialog.close();
    renderFeedbackList();
    feedbackListDialog.showModal();
    return;
  }

  if (saveFeedback(text)) {
    feedbackDialog.close();
    window.setTimeout(() => {
      alert("反馈已提交，感谢你的建议！");
    }, 100);
  } else {
    alert("保存失败，请重试。");
  }
});

closeFeedbackListDialog.addEventListener("click", () => {
  feedbackListDialog.close();
});

feedbackExport.addEventListener("click", () => {
  const list = getFeedbackList();
  if (list.length === 0) {
    alert("暂无反馈可导出");
    return;
  }
  const data = JSON.stringify(list, null, 2);
  navigator.clipboard.writeText(data).then(() => {
    alert(`已复制 ${list.length} 条反馈到剪贴板`);
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
