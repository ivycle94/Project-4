// Express docs: http://expressjs.com/en/api.html
const express = require('express')
// Passport docs: http://www.passportjs.org/docs/
const passport = require('passport')

// pull in Mongoose model for Setup
const Setup = require('../models/setup')

// this is a collection of methods that help us detect situations when we need
// to throw a custom error
const customErrors = require('../../lib/custom_errors')

// we'll use this function to send 404 when non-existant document is requested
const handle404 = customErrors.handle404
// we'll use this function to send 401 when a user tries to modify a resource
// that's owned by someone else
const requireOwnership = customErrors.requireOwnership

// this is middleware that will remove blank fields from `req.body`, e.g.
// { setup: { title: '', text: 'foo' } } -> { setup: { text: 'foo' } }
const removeBlanks = require('../../lib/remove_blank_fields')
// passing this as a second argument to `router.<verb>` will make it
// so that a token MUST be passed for that route to be available
// it will also set `req.user`
const requireToken = passport.authenticate('bearer', { session: false })

// instantiate a router (mini app that only handles routes)
const router = express.Router()

// INDEX
// GET /setups
// W O R K S //
router.get('/setups', (req, res, next) => {
	Setup.find()
		.then((setups) => {
			// `setups` will be an array of Mongoose documents
			// we want to convert each one to a POJO, so we use `.map` to
			// apply `.toObject` to each one
			return setups.map((setup) => setup.toObject())
		})
		// respond with status 200 and JSON of the setups
		.then((setups) => res.status(200).json({ setups: setups }))
		// if an error occurs, pass it to the handler
		.catch(next)
})

// SHOW
// GET /setups/5a7db6c74d55bc51bdf39793
// W O R K S //
router.get('/setups/:id', requireToken, (req, res, next) => {
	// req.params.id will be set based on the `:id` in the route
	Setup.findById(req.params.id)
		.then(handle404)
		// if `findById` is succesful, respond with 200 and "setup" JSON
		.then((setup) => res.status(200).json({ setup: setup.toObject() }))
		// if an error occurs, pass it to the handler
		.catch(next)
})

// CREATE
// POST /setups
// W O R K S //
router.post('/setups', requireToken, (req, res, next) => {
	// set owner of new setup to be current user
	req.body.setup.owner = req.user.id

	Setup.create(req.body.setup)
		// respond to succesful `create` with status 201 and JSON of new "setup"
		.then((setup) => {
			res.status(201).json({ setup: setup.toObject() })
		})
		// if an error occurs, pass it off to our error handler
		// the error handler needs the error message and the `res` object so that it
		// can send an error message back to the client
		.catch(next)
})

// UPDATE
// PATCH /setups/5a7db6c74d55bc51bdf39793
// W O R K S //
router.patch('/setups/:id', requireToken, removeBlanks, (req, res, next) => {
	// if the client attempts to change the `owner` property by including a new
	// owner, prevent that by deleting that key/value pair
	delete req.body.setup.owner

	Setup.findById(req.params.id)
		.then(handle404)
		.then((setup) => {
			// pass the `req` object and the Mongoose record to `requireOwnership`
			// it will throw an error if the current user isn't the owner
			requireOwnership(req, setup)

			// pass the result of Mongoose's `.update` to the next `.then`
			return setup.updateOne(req.body.setup)
		})
		// if that succeeded, return 204 and no JSON
		.then(() => res.sendStatus(204))
		// if an error occurs, pass it to the handler
		.catch(next)
})

// DESTROY
// DELETE /setups/5a7db6c74d55bc51bdf39793
// W O R K S //
router.delete('/setups/:id', requireToken, (req, res, next) => {
	Setup.findById(req.params.id)
		.then(handle404)
		.then((setup) => {
			// throw an error if current user doesn't own `setup`
			requireOwnership(req, setup)
			// delete the setup ONLY IF the above didn't throw
			setup.deleteOne()
		})
		// send back 204 and no content if the deletion succeeded
		.then(() => res.sendStatus(204))
		// if an error occurs, pass it to the handler
		.catch(next)
})

module.exports = router
