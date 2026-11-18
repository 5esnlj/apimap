const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const GEOCODE_INTERVAL_MS = 1100;

const places = {
  origin: { input: document.querySelector("#origin-input"), selected: null },
  destination: { input: document.querySelector("#destination-input"), selected: null },
};

const geocodeQueue = [];
let geocodeRunning = false;
let lastGeocodeStartedAt = 0;

function setStatus(key, message, state = "") {
  const status = document.querySelector(`#${key}-status`);
  status.textContent = message;
  status.dataset.state = state;
}

function clearRoute() {
  document.querySelector("#distance-card").hidden = true;
  const mapLink = document.querySelector("#map-link");
  mapLink.removeAttribute("href");
  mapLink.hidden = false;
}

function updateCalculateButton() {
  document.querySelector("#calculate-button").disabled =
    !places.origin.selected || !places.destination.selected;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function drainGeocodeQueue() {
  if (geocodeRunning) return;
  geocodeRunning = true;

  while (geocodeQueue.length) {
    const task = geocodeQueue.shift();
    const delay = Math.max(0, GEOCODE_INTERVAL_MS - (Date.now() - lastGeocodeStartedAt));
    if (delay) await wait(delay);
    lastGeocodeStartedAt = Date.now();
    task();
  }

  geocodeRunning = false;
}

function enqueueGeocode(task) {
  geocodeQueue.push(task);
  void drainGeocodeQueue();
}

async function searchPlace(key) {
  const place = places[key];
  const query = place.input.value.trim();
  const resultsElement = document.querySelector(`#${key}-results`);
  const selectedElement = document.querySelector(`#${key}-selected`);
  const searchButton = document.querySelector(`[data-search="${key}"]`);

  if (query.length < 2) {
    setStatus(key, "두 글자 이상 입력해 주세요.", "error");
    place.input.focus();
    return;
  }

  place.selected = null;
  selectedElement.hidden = true;
  resultsElement.hidden = true;
  resultsElement.replaceChildren();
  clearRoute();
  updateCalculateButton();
  searchButton.disabled = true;
  setStatus(key, "장소를 찾고 있어요…");

  enqueueGeocode(async () => {
    try {
      const url = new URL(NOMINATIM_URL);
      url.search = new URLSearchParams({
        q: query,
        format: "jsonv2",
        addressdetails: "1",
        limit: "5",
        "accept-language": "ko",
      });
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`검색 서비스 응답 오류 (${response.status})`);
      const matches = await response.json();

      if (place.input.value.trim() !== query) {
        setStatus(key, "입력 내용이 변경되었어요. 다시 검색해 주세요.");
        return;
      }

      if (!Array.isArray(matches) || matches.length === 0) {
        setStatus(key, "검색 결과가 없어요. 동네나 도시 이름을 덧붙여 다시 검색해 주세요.", "error");
        return;
      }

      renderResults(key, matches);
      setStatus(key, `${matches.length}개의 장소를 찾았어요. 정확한 장소를 선택해 주세요.`, "success");
    } catch (error) {
      if (place.input.value.trim() === query) {
        setStatus(key, error instanceof Error ? error.message : "장소 검색에 실패했어요. 잠시 후 다시 시도해 주세요.", "error");
      }
    } finally {
      searchButton.disabled = false;
    }
  });
}

function renderResults(key, matches) {
  const resultsElement = document.querySelector(`#${key}-results`);
  resultsElement.replaceChildren();

  for (const match of matches) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "result-option";
    option.setAttribute("role", "option");

    const name = document.createElement("span");
    name.className = "result-name";
    name.textContent = match.display_name;

    const coordinates = document.createElement("span");
    coordinates.className = "result-coordinates";
    coordinates.textContent = `${Number(match.lat).toFixed(4)}, ${Number(match.lon).toFixed(4)}`;

    option.append(name, coordinates);
    option.addEventListener("click", () => selectPlace(key, match));
    resultsElement.append(option);
  }

  resultsElement.hidden = false;
}

function selectPlace(key, match) {
  const place = places[key];
  const resultsElement = document.querySelector(`#${key}-results`);
  const selectedElement = document.querySelector(`#${key}-selected`);
  const label = match.display_name;

  place.selected = {
    label,
    lat: Number(match.lat),
    lon: Number(match.lon),
  };
  place.input.value = label;
  resultsElement.hidden = true;
  selectedElement.textContent = `${label} 선택됨`;
  selectedElement.hidden = false;
  setStatus(key, "검색 결과에서 장소를 확인했어요.", "success");
  clearRoute();
  updateCalculateButton();
}

function formatDistance(meters) {
  const kilometers = meters / 1000;
  const digits = kilometers < 10 ? 1 : 0;
  return `${kilometers.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} km`;
}

async function calculateDistance() {
  const origin = places.origin.selected;
  const destination = places.destination.selected;
  if (!origin || !destination) return;

  const button = document.querySelector("#calculate-button");
  const buttonLabel = button.querySelector("span");
  const distanceCard = document.querySelector("#distance-card");
  button.disabled = true;
  buttonLabel.textContent = "경로를 계산하고 있어요…";
  distanceCard.hidden = true;

  try {
    const coordinates = `${origin.lon},${origin.lat};${destination.lon},${destination.lat}`;
    const url = `${OSRM_URL}/${coordinates}?overview=false&steps=false`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`경로 서비스 응답 오류 (${response.status})`);
    const data = await response.json();
    if (data.code !== "Ok" || !data.routes?.length) {
      throw new Error("이 두 장소 사이의 자동차 경로를 찾지 못했어요.");
    }

    document.querySelector("#distance-value").textContent = formatDistance(data.routes[0].distance);
    document.querySelector("#distance-description").textContent = `${origin.label} → ${destination.label}`;

    const mapUrl = new URL("https://www.openstreetmap.org/directions");
    mapUrl.searchParams.set("engine", "fossgis_osrm_car");
    mapUrl.searchParams.set("route", `${origin.lat},${origin.lon};${destination.lat},${destination.lon}`);
    const mapLink = document.querySelector("#map-link");
    mapLink.href = mapUrl.toString();
    mapLink.hidden = false;
    distanceCard.hidden = false;
  } catch (error) {
    distanceCard.hidden = false;
    document.querySelector("#distance-value").textContent = "계산 실패";
    document.querySelector("#distance-description").textContent =
      error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.";
    document.querySelector("#map-link").removeAttribute("href");
    document.querySelector("#map-link").hidden = true;
  } finally {
    button.disabled = false;
    buttonLabel.textContent = "거리 다시 계산하기";
  }
}

for (const key of Object.keys(places)) {
  document.querySelector(`[data-search="${key}"]`).addEventListener("click", () => searchPlace(key));
  places[key].input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") searchPlace(key);
  });
  places[key].input.addEventListener("input", () => {
    if (places[key].selected && places[key].input.value !== places[key].selected.label) {
      places[key].selected = null;
      document.querySelector(`#${key}-selected`).hidden = true;
      setStatus(key, "장소가 변경되었어요. 다시 검색해 주세요.");
      clearRoute();
      updateCalculateButton();
    }
  });
}

document.querySelector("#calculate-button").addEventListener("click", calculateDistance);
document.querySelector("#map-link").addEventListener("click", (event) => {
  const href = event.currentTarget.getAttribute("href");
  if (!href || href === "#") {
    event.preventDefault();
  }
});
