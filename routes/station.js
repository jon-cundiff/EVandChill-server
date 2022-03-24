require("dotenv").config();
const express = require("express")
const router = express.Router()
const Station = require('../schema/station')
const StationResult = require('../schema/stationResult')
const User = require('../schema/user')
const latLongFromLocation = require('../util/locationToCoords')
const axios = require('axios');

const instance = axios.create({
    baseURL: `https://api.openchargemap.io/v3/poi/?key=${process.env.OCM_API_KEY}&countrycode=US`
})

// search by zip code, city/state or user's location
router.post('/stations', async (req, res) => {

    // const stations = checkDBForStations(location)
    // if (stations) {
    //     // stations are in DB and less than 24 hrs old, use these
    // } else {
    //     // ask the API for stations, add to DB
    // }

    if (req.body.searchBox) {
        // city or zip entered in search
        const location = await latLongFromLocation(req.body.searchBox)
        try {
            console.log(location)
            const response = await instance.get(`&latitude=${location.lat}&longitude=${location.lng}`)
            // SAVE TO DB
            saveStationsToDB(response.data)
            //console.log(response.data)
            res.json(response.data)
        } catch (err) {
            console.log(err)
        }

    } else {
        // search by user's location
        try {
            const response = await instance.get(`&maxresults=10&latitude=${req.body.latitude}&longitude=${req.body.longitude}`)
            res.json(response)
        } catch (err) {
            console.log(err)
        }
    }

})

router.post('/add-favorite', async (req, res) => {
    const stationNumber = req.body.stationNumber
    const username = req.body.username

    const user = await User.findOne({ username: username }) // or however the JWT is set up

    if (user) {
        try {
            // add to favorites list of logged in user
            user.favorites.push({
                stationId: stationNumber,
                user: user._id
            })
            const saved = await user.save()
            if (saved) {
                res.json({ success: true, message: 'Added to favorites.' })
            } else {
                res.json({ success: false, message: 'Error!' })
            }
        } catch (err) {
            console.log(err)
        }
    } else {
        // user does not exist
        res.json({ success: false, message: 'Invalid username.' })
    }
})

router.delete('/remove-favorite', async (req, res) => {
    const favoriteId = req.body.favoriteId
    const username = req.body.username

    const user = await User.findOne({ username: username }) // or however the JWT is set up

    if (user) {
        try {
            // remove favorite with pull
            user.favorites.pull(favoriteId)
            const saved = await user.save()
            if (saved) {
                res.json({ success: true, message: 'Removed from favorites.' })
            } else {
                res.json({ success: false, message: 'Error!' })
            }

        } catch (err) {
            console.log(err)
        }
    } else {
        // user does not exist
        res.json({ success: false, message: 'Invalid username.' })
    }
})

router.post('/add-photo', async (req, res) => {

})

// FUNCTIONS

const checkDBForStations = (coords) => {

}

const saveStationsToDB = (stations) => {
    console.log('saving...')
    //const options = { upsert: true, new: true, setDefaultsOnInsert: true }
    stations.forEach(async station => {
        const connections = station.Connections.map(connection =>
        ({
            type: connection.ConnectionType.Title,
            speed: connection.ConnectionType.ID
        }))
        console.log(connections)

        await Station.create({
            externalId: station.UUID,
            lastUpdated: station.DataProvider.DateLastImported,
            name: station.AddressInfo.Title,
            address: `${station.AddressInfo.AddressLine1} ${station.AddressInfo.Town}, ${station.AddressInfo.StateOrProvince} ${station.AddressInfo.Postcode}`,
            latitude: station.AddressInfo.Latitude.toFixed(1),
            longitude: station.AddressInfo.Longitude.toFixed(1),
            plugTypes: connections,
            supportNumber: station.OperatorInfo ? station.OperatorInfo.PhonePrimaryContact ? station.OperatorInfo.PhonePrimaryContact : null : null,
            operatingHours: station.AddressInfo.AccessComments ? station.AddressInfo.AccessComments : null
        })
        // await Station.deleteMany({})
    })
}

module.exports = router;




