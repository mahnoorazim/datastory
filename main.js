const width = document.getElementById("viz-left").clientWidth;
const height = window.innerHeight;

const svg = d3
  .select("#globe")
  .attr("viewBox", `0 0 ${width} ${height}`)
  .attr("preserveAspectRatio", "xMidYMid meet");

const projection = d3
  .geoOrthographic()
  .scale(Math.min(width, height) * 0.56)
  .translate([width / 2, height / 2])
  .clipAngle(90);

const path = d3.geoPath(projection);

const colors = {
  sleep: "#4e79a7",
  work: "#f28e2b",
  unpaid: "#e15759",
  eating: "#76b7b2",
  travel: "#59a14f",
  leisure: "#edc949"
};


const countryMeta = {
  Australia: { city: "Sydney", coords: [151.2093, -33.8688] },
  Japan: { city: "Tokyo", coords: [139.6917, 35.6895] },
  India: { city: "Delhi", coords: [77.1025, 28.7041] },
  France: { city: "Paris", coords: [2.3522, 48.8566] },
  "South Africa": { city: "Cape Town", coords: [18.4241, -33.9249] },
  Mexico: { city: "Mexico City", coords: [-99.1332, 19.4326] }
};


const shownCountries = new Set();
let worldGeojson;
let timeUseData;
let hasActivatedSplit = false;

const stickyPanel = document.getElementById("sticky-panel");
const tooltip = d3.select("body")
  .append("div")
  .attr("class", "segment-tooltip")
  .style("opacity", 0);

const sphere = { type: "Sphere" };

const defs = svg.append("defs");
const glow = defs.append("filter").attr("id", "glow");

glow.append("feGaussianBlur")
  .attr("stdDeviation", "10")
  .attr("result", "blur");

glow.append("feMerge")
  .selectAll("feMergeNode")
  .data(["blur", "SourceGraphic"])
  .enter()
  .append("feMergeNode")
  .attr("in", d => d);

const globeGroup = svg.append("g");

globeGroup
  .append("path")
  .datum(sphere)
  .attr("class", "ocean")
  .attr("fill", "#0d203c")
  .attr("stroke", "rgba(255,255,255,0.18)")
  .attr("stroke-width", 1.2)
  .attr("d", path);

const graticule = d3.geoGraticule10();

globeGroup
  .append("path")
  .datum(graticule)
  .attr("fill", "none")
  .attr("stroke", "rgba(255,255,255,0.10)")
  .attr("stroke-width", 0.7)
  .attr("d", path);

const countriesLayer = globeGroup.append("g");
const cityLayer = globeGroup.append("g");

Promise.all([
  d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
  d3.csv("data/time_use.csv", d3.autoType)
]).then(([world, csv]) => {
  worldGeojson = topojson.feature(world, world.objects.countries);
  timeUseData = csv;

  drawWorld();
  drawGlobalLegend();
  setupScroller();
});

function drawGlobalLegend() {
  const categories = [
    { key: "sleep", label: "Sleep / Personal Care" },
    { key: "work", label: "Paid Work / Study" },
    { key: "unpaid", label: "Unpaid Work / Care" },
    { key: "eating", label: "Eating / Drinking" },
    { key: "travel", label: "Travel" },
    { key: "leisure", label: "Leisure / Social" }
  ];

  const legend = d3
    .select("#viz-right")
    .insert("div", "#comparison-wall")
    .attr("class", "global-legend");

  categories.forEach(cat => {
    const item = legend.append("div").attr("class", "legend-item");
    item.append("span")
      .attr("class", "legend-swatch")
      .style("background", colors[cat.key]);
    item.append("span").text(cat.label);
  });
}

function drawWorld() {
  countriesLayer
    .selectAll("path")
    .data(worldGeojson.features)
    .join("path")
    .attr("d", path)
    .attr("fill", "#4a6a91")
    .attr("stroke", "rgba(255,255,255,0.22)")
    .attr("stroke-width", 0.6);
}

function redrawGlobe(activeCountry = null) {
  globeGroup.selectAll("path").attr("d", path);

  countriesLayer
    .selectAll("path")
    .attr("fill", d => d.properties.name === activeCountry ? "#f3b44b" : "#4a6a91")
    .attr("filter", d => d.properties.name === activeCountry ? "url(#glow)" : null);

  cityLayer
    .selectAll("circle")
    .attr("cx", d => projection(d.coords)[0])
    .attr("cy", d => projection(d.coords)[1]);

  cityLayer
    .selectAll("text")
    .attr("x", d => projection(d.coords)[0] + 10)
    .attr("y", d => projection(d.coords)[1] + 4);

}

function rotateToCountry(countryName) {
  const meta = countryMeta[countryName];
  if (!meta) return;

  const [lon, lat] = meta.coords;
  const currentRotate = projection.rotate();
  const targetRotate = [-lon, -lat, 0];

  d3.transition()
    .duration(1200)
    .tween("rotate", () => {
      const r = d3.interpolate(currentRotate, targetRotate);
      return t => {
        projection.rotate(r(t));
        redrawGlobe(countryName);
        drawCity(countryName);
      };
    });
}

function drawCity(countryName) {
  const meta = countryMeta[countryName];
  if (!meta) return;

  const cityData = [{ name: meta.city, coords: meta.coords }];

  cityLayer
    .selectAll("circle")
    .data(cityData, d => d.name)
    .join(
      enter => enter.append("circle")
        .attr("r", 5)
        .attr("fill", "#ffffff")
        .attr("stroke", "#f3b44b")
        .attr("stroke-width", 2)
        .attr("cx", d => projection(d.coords)[0])
        .attr("cy", d => projection(d.coords)[1]),
      update => update
        .attr("cx", d => projection(d.coords)[0])
        .attr("cy", d => projection(d.coords)[1]),
      exit => exit.remove()
    );

  cityLayer
    .selectAll("text")
    .data(cityData, d => d.name)
    .join(
      enter => enter.append("text")
        .attr("fill", "#ffffff")
        .attr("font-size", 13)
        .attr("x", d => projection(d.coords)[0] + 10)
        .attr("y", d => projection(d.coords)[1] + 4)
        .text(d => d.name),
      update => update
        .attr("x", d => projection(d.coords)[0] + 10)
        .attr("y", d => projection(d.coords)[1] + 4),
      exit => exit.remove()
    );
}

function equivalentLine(key, hours) {
  const mins = Math.round(hours * 60);
  const base = {
    sleep: { unit: 90, label: "sleep cycles" },
    work: { unit: 50, label: "focused work blocks" },
    unpaid: { unit: 30, label: "household/care tasks" },
    eating: { unit: 30, label: "meal-length blocks" },
    travel: { unit: 45, label: "urban commute legs" },
    leisure: { unit: 60, label: "free-time hours" }
  }[key];
  const count = (mins / base.unit).toFixed(1);
  return `Roughly ${count} ${base.label}.`;
}

function showSegmentTooltip(event, payload) {
  const pct = ((payload.hours / 24) * 100).toFixed(1);
  const eq = equivalentLine(payload.key, payload.hours);

  tooltip
    .html(
      `<div class="tooltip-title">${payload.country} - ${payload.label}</div>
       <div class="tooltip-metric"><strong>${payload.hours.toFixed(1)}h</strong> (${pct}% of day)</div>
       <div class="tooltip-equivalent">${eq}</div>`
    )
    .style("opacity", 1);

  moveSegmentTooltip(event);
}

function moveSegmentTooltip(event) {
  const x = event.pageX + 14;
  const y = event.pageY + 14;
  tooltip
    .style("left", `${x}px`)
    .style("top", `${y}px`);
}

function hideSegmentTooltip() {
  tooltip.style("opacity", 0);
}

function addCountryCard(countryName) {
  if (shownCountries.has(countryName)) return;
  shownCountries.add(countryName);

  const row = timeUseData.find(d => d.country === countryName);
  if (!row) return;

  const categories = [
    { key: "sleep", label: "Sleep / Personal Care", hours: +row.sleep },
    { key: "work", label: "Paid Work / Study", hours: +row.work },
    { key: "unpaid", label: "Unpaid Work / Care", hours: +row.unpaid },
    { key: "eating", label: "Eating / Drinking", hours: +row.eating },
    { key: "travel", label: "Travel", hours: +row.travel },
    { key: "leisure", label: "Leisure / Social", hours: +row.leisure }
  ];

  const card = d3
    .select("#comparison-wall")
    .append("div")
    .attr("class", "country-card")
    .attr("data-country", countryName)
    .style("opacity", 0)
    .style("transform", "translateY(20px)");

  card.append("h3").text(countryName);

  const cardWidth = document.getElementById("viz-right").clientWidth - 80;
  const timelineWidth = Math.max(280, cardWidth - 30);
  const timelineHeight = 28;

  const timelineSvg = card
    .append("svg")
    .attr("width", timelineWidth)
    .attr("height", 66);

  const x = d3.scaleLinear()
    .domain([0, 24])
    .range([0, timelineWidth]);

  let cumulative = 0;

  categories.forEach(cat => {
    const startHour = cumulative;
    timelineSvg
      .append("rect")
      .attr("class", "timeline-segment")
      .attr("x", x(cumulative))
      .attr("y", 7)
      .attr("width", 0)
      .attr("height", timelineHeight)
      .attr("fill", colors[cat.key])
      .on("mouseenter", function(event) {
        d3.select(this).attr("stroke", "rgba(255,255,255,0.9)").attr("stroke-width", 1.2);
        showSegmentTooltip(event, {
          country: countryName,
          key: cat.key,
          label: cat.label,
          hours: cat.hours
        });
      })
      .on("mousemove", moveSegmentTooltip)
      .on("mouseleave", function() {
        d3.select(this).attr("stroke", "none");
        hideSegmentTooltip();
      })
      .transition()
      .duration(700)
      .delay(cumulative * 40)
      .attr("width", x(cat.hours));

    cumulative += cat.hours;
  });

  const axis = d3.axisBottom(x)
    .tickValues([0, 6, 12, 18, 24])
    .tickFormat(d => `${d}:00`);

  timelineSvg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${timelineHeight + 13})`)
    .call(axis);

  card
    .transition()
    .duration(700)
    .style("opacity", 1)
    .style("transform", "translateY(0px)");
}

function activateSplitLayout() {
  if (hasActivatedSplit) return false;
  hasActivatedSplit = true;
  document.body.classList.add("split-started");
  stickyPanel.classList.remove("intro-mode");
  stickyPanel.classList.add("split-active");
  return true;
}

function setupScroller() {
  const scroller = scrollama();

  scroller
    .setup({
      step: ".step",
      offset: 0.6,
      debug: false
    })
    .onStepEnter(response => {
      const step = response.element;
      const countryName = step.dataset.country;
      const activatedNow = activateSplitLayout();
      rotateToCountry(countryName);
      if (activatedNow) {
        setTimeout(() => addCountryCard(countryName), 520);
      } else {
        addCountryCard(countryName);
      }
    });

  window.addEventListener("resize", () => scroller.resize());
}