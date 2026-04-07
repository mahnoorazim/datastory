const width = document.getElementById("viz-left").clientWidth;
const height = window.innerHeight;

const svg = d3
  .select("#globe")
  .attr("viewBox", `0 0 ${width} ${height}`)
  .attr("preserveAspectRatio", "xMidYMid meet");

const projection = d3
  .geoOrthographic()
  .scale(Math.min(width, height) * 0.33)
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
  setupScroller();
});

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
    .duration(1600)
    .tween("rotate", () => {
      const r = d3.interpolate(currentRotate, targetRotate);
      return t => {
        projection.rotate(r(t));
        redrawGlobe(countryName);
        drawCity(countryName);
      };
    });

  d3.select("#country-label").text(`${meta.city}, ${countryName}`);
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
    .style("opacity", 0)
    .style("transform", "translateY(20px)");

  card.append("h3").text(countryName);

  const cardWidth = document.getElementById("viz-right").clientWidth - 80;
  const timelineWidth = Math.max(280, cardWidth - 30);
  const timelineHeight = 46;

  const timelineSvg = card
    .append("svg")
    .attr("width", timelineWidth)
    .attr("height", 100);

  const x = d3.scaleLinear()
    .domain([0, 24])
    .range([0, timelineWidth]);

  let cumulative = 0;

  categories.forEach(cat => {
    timelineSvg
      .append("rect")
      .attr("x", x(cumulative))
      .attr("y", 8)
      .attr("width", 0)
      .attr("height", timelineHeight)
      .attr("fill", colors[cat.key])
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
    .attr("transform", `translate(0, ${timelineHeight + 14})`)
    .call(axis);

  const legend = card.append("div").attr("class", "legend");

  categories.forEach(cat => {
    const item = legend.append("div").attr("class", "legend-item");
    item.append("span")
      .attr("class", "legend-swatch")
      .style("background", colors[cat.key]);
    item.append("span").text(`${cat.label}: ${cat.hours}h`);
  });

  card
    .transition()
    .duration(700)
    .style("opacity", 1)
    .style("transform", "translateY(0px)");
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
      rotateToCountry(countryName);
      addCountryCard(countryName);
    });

  window.addEventListener("resize", () => scroller.resize());
}