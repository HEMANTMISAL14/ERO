import mapboxgl from "mapbox-gl";
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder'
import { dbRef, get, child } from "./firebase";
import { distance } from "@turf/turf";
// import base

let evPercent = document.querySelector('.percentage')
let evCapacity = document.querySelector('.capacity')
let evRange = document.querySelector('.range')


const RED_MARKER = '#f82d38'
const CHARGER_MARKER = '#33ff3399'
// const ROAD = "#a0d8f4"
const ROAD = "#3165c3"
const GREEN = "#33ff44"


let range = 316 // km
let percentage = 10
let capacity = 60


let canTravel = (range*percentage/100)*1000 // meters


let storedData = localStorage.getItem('ero')
if (storedData) {
    storedData = JSON.parse(storedData)
    range = storedData.range
    percentage = storedData.percentage
    capacity = storedData.capacity

    evPercent.value = storedData.percentage
    evCapacity.value = storedData.capacity
    evRange.value = storedData.range

    // console.log(storedData);
}



const key = 'pk.eyJ1IjoiaGVtYW50MTQiLCJhIjoiY2x0OXFrbjhqMTV2ajJscng0d2RrYW92ayJ9.m7JpuR1dHUVOHhmxryYNYg'
mapboxgl.accessToken = key;

let map = new mapboxgl.Map({
    container: 'map',
    // style: 'mapbox://styles/mapbox/navigation-night-v1',
    center: [18, 73],
    zoom: 16
});


let chargers = []
get(child(dbRef, `chargers`)).then((snapshot) => {
    if (snapshot.exists()) {
        chargers = snapshot.val().slice(0, 100)
        // console.log(chargers);
        for (let i = 0; i < chargers.length; i++) {
            if (chargers[i].longitude && chargers[i].lattitude) {
                new mapboxgl.Popup()
                .setLngLat([chargers[i].longitude, chargers[i].lattitude])
                .setHTML(`<p>${chargers[i].address}</p>`)
                .addTo(map);

                let marker = new mapboxgl.Marker({
                    color: CHARGER_MARKER,
                }).setLngLat([parseFloat(chargers[i].longitude), parseFloat(chargers[i].lattitude)])
                .addTo(map)
            }
        }
        // map.addControl(new MarkerOptions())
    } 
}).catch((error) => {
    console.error(error);
});


const img = 'https://www.clipartmax.com/png/middle/213-2132113_lightning-bolt-icon-art-iphone-lightning-bolt-png.png'
function plotCharger(arr, color=CHARGER_MARKER) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i].longitude && arr[i].lattitude) {

            new mapboxgl.Marker({
                color: color,
            }).setLngLat([parseFloat(arr[i].longitude), parseFloat(arr[i].lattitude)])
            .addTo(map)
        }
    }

}


let coords = []
let markers = []
let shortest = []
let selected = []


// search box
const geocoder1 = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken, 
    mapboxgl: mapboxgl, 
    marker: true, 
    placeholder: 'Enter start location'
});
document.querySelector('#geocoder1').appendChild(geocoder1.onAdd(map))

geocoder1.on('result', function(e) {
    console.log('Selected location:', e.result);
    var latitude = e.result.geometry.coordinates[1];
    var longitude = e.result.geometry.coordinates[0];
    console.log('Latitude:', latitude);
    console.log('Longitude:', longitude);
    
    markers.forEach(marker => marker.remove())
    markers = []
    markers[0] = new mapboxgl.Marker({ color: RED_MARKER, }).setLngLat([longitude, latitude]).addTo(map)
    map.panTo([longitude, latitude])
    
    if (map.getLayer('route')) map.removeLayer('route');
    if (map.getSource('route')) map.removeSource('route');

    if (markers[1]) drawLine([[lng, lat], [longitude, latitude]], map, ROAD)
});

const geocoder2 = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken, 
    mapboxgl: mapboxgl, 
    marker: true, 
    placeholder: 'Enter Destination'
});
document.querySelector('#geocoder2').appendChild(geocoder2.onAdd(map))

geocoder2.on('result', function(e) {
    console.log('Selected location:', e.result);
    var latitude = e.result.geometry.coordinates[1];
    var longitude = e.result.geometry.coordinates[0];
    
    if (markers[1]) markers[1].remove()
    markers[1] = new mapboxgl.Marker({ color: RED_MARKER, }).setLngLat([longitude, latitude]).addTo(map)

    map.panTo([longitude, latitude])
    
    let {lng, lat} = markers[0].getLngLat()
    
    if (map.getLayer('route')) map.removeLayer('route');
    if (map.getSource('route')) map.removeSource('route');

    if (markers[0]) drawLine([[lng, lat], [longitude, latitude]], map, ROAD)
});





let index = 0
map.on('style.load', function() {
    console.log(map.setConfigProperty);
    map.setConfigProperty(
        "basemap",
        "lightPreset",
        "dawn",
        "showPointOfInterestLabels",
        true
    );

    // red marker
    map.on('click', function(e) {
        var {lng, lat} = e.lngLat;

        let marker = new mapboxgl.Marker({
            color: RED_MARKER,
            // draggable: true,
        }).setLngLat([lng, lat])
        .addTo(map)

        // console.log(index++ % 2);
        if (coords.length == 2 || markers.length == 2) {
            index = 0
            markers.forEach(marker => marker.remove())
            coords = []
            markers = []
            
            if (map.getLayer('route')) map.removeLayer('route');
            if (map.getSource('route')) map.removeSource('route');
        }
        
        // markers.push(marker)
        markers.push(marker)
        coords[index++ % 2] = [lng, lat]
        drawLine(coords, map)
    })

})


navigator.geolocation.getCurrentPosition((position) => {
    setupMap([position.coords.longitude, position.coords.latitude])
})

function setupMap(center) {
    map = new mapboxgl.Map({
        container: 'map',
        // style: 'mapbox://styles/mapbox/navigation-night-v1',
        center: center,
        zoom: 16
    });
}

// map.addSource('route', {})

let dist = 0
async function drawLine(coords, map, color = ROAD) {
    if (coords.length < 2) return
    console.log(coords);
    

    let data = await fetchActualDistance(coords)
    if (!data) return

    var route = await data.routes[0].geometry;
    if (!route) return

    
    await shortest.forEach(short => short.remove())  
    await selected.forEach(select => select.remove())

    let closestArr = findClosest(coords[0], coords[1])

    let optimal = getOptimal(closestArr)


    if (data.routes[0].distance > canTravel) {
        
        alert('Cannot reach the destination, are you in trouble? call ERO helpline number!')
        // dist =  await data.routes[0].distance

    }
    // else {
        await map.addSource('route', {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'properties': {},
                'geometry': route
            }
        });
    
        await map.addLayer({
            'id': 'route',
            'type': 'line',
            'source': 'route',
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': color,
                'line-width': 8
            }
        })
    // }

    
}

const opt = {
    units: 'meters'
}

function findClosest(coord1, coord2) {
    shortest.forEach(short => short.remove())

    let arr = []
    let dist = distance(coord1, coord2, opt)
    chargers.forEach(charger => {
        if (distance([charger.longitude, charger.lattitude], coord1, opt) < dist) {
            arr.push(charger)
            // plotCharger([charger], '#333')
            shortest.push(new mapboxgl.Marker({
                color: '#333a',
            }).setLngLat([parseFloat(charger.longitude), parseFloat(charger.lattitude)])
            .addTo(map))
        }
    })

    return arr
}

async function fetchActualDistance(coords) {
    console.log(coords);
    let res = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords[0][0]},${coords[0][1]};${coords[1][0]},${coords[1][1]}?steps=true&geometries=geojson&access_token=${key}`)
    let data = await res.json()
    return data
}

async function getOptimal(closestArr) {
    selected.forEach(select => select.remove())

    // let res = await Promise.all(closestArr.map(async charger => {
     let c = closestArr.map(charger => {
        let dist1 = distance([charger.longitude, charger.lattitude], coords[0], opt)
        let dist2 = distance([charger.longitude, charger.lattitude], coords[1], opt)
            
        let d = dist1/dist2
        // if (d > canTravel)

        // console.log(dist1, canTravel);
        // if (dist1 > canTravel) {
        //     return {charger, d: 0}
        // }
        // else {
        //     return { charger, d }
        // }
        return {charger, d}
    })

    let ds = Math.min(...c.map(charger => charger.d))
    c = c.filter(item => item.d == ds)[0]
    
    // console.log(c);
    if (c && c.charger) selected.push(new mapboxgl.Marker({
        color: '#ff3',
    }).setLngLat([parseFloat(c.charger.longitude), parseFloat(c.charger.lattitude)])
    .addTo(map))
    else {
        console.log(dist);
    }

    let data = await fetchActualDistance(coords)
    console.log(data);

    if (!data) return

    var route = await data.routes[0].geometry;
    console.log(route);
    
    if (data.routes[0].distance > range) return


}


let toggleButton = document.querySelector('.viewer')
let is3D = false

toggleButton.addEventListener("click", function () {
    // Toggle the value of the is3D variable
    is3D = !is3D;

    // Update the map view based on the current mode
    if (is3D) {
        // Switch to 3D view
        map.setPitch(45)
        map.setBearing(-17.6)
        toggleButton.querySelector('.dot').style.left = '75%'
        toggleButton.querySelector('.mode').innerText = '3D'
        toggleButton.querySelector('.mode').style.left = '30%'
        toggleButton.style.background = 'var(--red)'
        // toggleButton.innerText = "3D"; // Change the button text to "3D"
        map.dragRotate.enable();
        map.touchZoomRotate.enableRotation();
        //console.log("3d");
    } else {
        // Switch to 2D view
        map.setPitch(0);
        map.setBearing(0);
        toggleButton.querySelector('.dot').style.left = '25%'
        toggleButton.querySelector('.mode').innerText = '2D'
        toggleButton.querySelector('.mode').style.left = '70%'
        toggleButton.style.background = 'var(--blue)'
        // map.setZoom(5);
        map.dragRotate.disable();
        map.touchZoomRotate.disableRotation();
        // toggleButton.innerText = "2D"; // Change the button text to "2D"
        // console.log("2d");
    }
});
  



evPercent.oninput = () => {
    percentage = evPercent.value
    canTravel = (range*percentage/100)*1000
    updateStorage()
}
evRange.oninput = () => { 
    range = evRange.value // km
    canTravel = (range*percentage/100)*1000
    updateStorage()
}
evCapacity.oninput = () => {
    percentage = evPercent.value
    canTravel = (range*percentage/100)*1000
    updateStorage()
}

function updateStorage() {
    localStorage.setItem('ero', JSON.stringify({range: evRange.value, capacity: evCapacity.value, percentage: evPercent.value}))
}