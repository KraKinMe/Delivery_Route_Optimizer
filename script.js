let map;
let deliveryPoints = [];

function initMap() {
    map = L.map('map').setView([27.1767, 78.0081], 13); // Centered on Agra, India

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        const point = { lat, lng };
        deliveryPoints.push(point);
        const marker = L.marker([lat, lng]).addTo(map);
        marker.bindPopup(`<p>${lat.toFixed(4)}, ${lng.toFixed(4)}</p>`).openPopup();
    });
}

document.getElementById('optimizeBtn').addEventListener('click', () => {
    const k = parseInt(document.getElementById('clusterCount').value);
    optimizeDeliveryPath(k);
});

document.getElementById('clearBtn').addEventListener('click', () => {
    deliveryPoints = [];
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.Routing.Control) {
            map.removeLayer(layer);
        }
    });
    document.getElementById('clusterInfo').innerHTML = '';
});

function getRandomCentroids(k, points) {
    const centroids = [];
    for (let i = 0; i < k; i++) {
        const randomIndex = Math.floor(Math.random() * points.length);
        centroids.push(points[randomIndex]);
    }
    return centroids;
}

function assignPointsToCentroids(points, centroids) {
    return points.map(point => {
        let closestCentroidIndex = 0;
        let minDistance = Number.MAX_VALUE;
        centroids.forEach((centroid, index) => {
            const distance = getDistance(point, centroid);
            if (distance < minDistance) {
                minDistance = distance;
                closestCentroidIndex = index;
            }
        });
        return { ...point, centroidIndex: closestCentroidIndex };
    });
}

function getDistance(point1, point2) {
    return Math.sqrt(Math.pow(point1.lat - point2.lat, 2) + Math.pow(point1.lng - point2.lng, 2));
}

function recomputeCentroids(assignments, k) {
    const newCentroids = Array(k).fill(null).map(() => ({ lat: 0, lng: 0, count: 0 }));
    assignments.forEach(({ lat, lng, centroidIndex }) => {
        newCentroids[centroidIndex].lat += lat;
        newCentroids[centroidIndex].lng += lng;
        newCentroids[centroidIndex].count += 1;
    });
    return newCentroids.map(({ lat, lng, count }) => ({
        lat: lat / count,
        lng: lng / count
    }));
}

function kMeansClustering(points, k) {
    let centroids = getRandomCentroids(k, points);
    let assignments;
    for (let i = 0; i < 10; i++) { 
        assignments = assignPointsToCentroids(points, centroids);
        centroids = recomputeCentroids(assignments, k);
    }
    return assignments;
}

function optimizeDeliveryPath(k) {
    if (!k || k <= 0) {
        alert('Please enter a valid number of clusters');
        return;
    }

    const clusters = kMeansClustering(deliveryPoints, k);

    map.eachLayer((layer) => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.Routing.Control) {
            map.removeLayer(layer);
        }
    });

    clusters.forEach((point, index) => {
        const marker = L.marker([point.lat, point.lng], {
            icon: L.divIcon({
                className: 'text-center',
                html: `<div class="bg-red-500 text-white p-1 rounded-full">${point.centroidIndex}</div>`,
                iconSize: [30, 30]
            })
        }).addTo(map);
        marker.bindPopup(`<div class="marker-popup bg-white shadow-md rounded-lg p-2"><p>${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}</p></div>`).openPopup();
    });

    displayClusterInfo(clusters);

    for (let i = 0; i < k; i++) {
        const clusterPoints = clusters.filter(point => point.centroidIndex === i);
        const optimizedPath = solveTSP(clusterPoints);

        if (optimizedPath.length > 1) {
            L.Routing.control({
                waypoints: optimizedPath.map(point => L.latLng(point.lat, point.lng)),
                createMarker: () => null,
                lineOptions: {
                    styles: [{ color: i % 2 === 0 ? "#FF0000" : "#0000FF", weight: 2 }]
                }
            }).addTo(map);
        }
    }
}

function solveTSP(points) {
    const n = points.length;
    if (n <= 1) return points;

    const visited = new Array(n).fill(false);
    const result = [points[0]];
    visited[0] = true;

    let current = points[0];

    for (let i = 1; i < n; i++) {
        let nextIndex = -1;
        let minDist = Infinity;

        for (let j = 0; j < n; j++) {
            if (!visited[j]) {
                const dist = getDistance(current, points[j]);
                if (dist < minDist) {
                    minDist = dist;
                    nextIndex = j;
                }
            }
        }

        if (nextIndex !== -1) {
            visited[nextIndex] = true;
            current = points[nextIndex];
            result.push(current);
        }
    }

    return result;
}

function displayClusterInfo(clusters) {
    const clusterInfoDiv = document.getElementById('clusterInfo');
    clusterInfoDiv.innerHTML = '';
    const clusterCounts = clusters.reduce((acc, point) => {
        acc[point.centroidIndex] = (acc[point.centroidIndex] || 0) + 1;
        return acc;
    }, {});
    Object.keys(clusterCounts).forEach(index => {
        clusterInfoDiv.innerHTML += `<p>Cluster ${index}: ${clusterCounts[index]} points</p>`;
    });
}

window.onload = initMap;
Explain