'use strict';

const express = require('express');
const router  = express.Router();
const User = require('./models')[0];
const Course = require('./models')[1];
const auth  = require('basic-auth');
const bcrypt = require('bcryptjs');

//returns currently authenticated user if no authentication sent it will send "Authentication Required" message
router.get('/users', (req, res, next) => {
    const credentials = auth(req);
    
    if(!credentials) return res.status(401).send();

    User
        .findOne({emailAddress: credentials.name})
        .exec(function(err, user) {
            if(err) return next (err);
            if(!user) return res.status(401).send();

            bcrypt.compare(credentials.pass, user.password, function(err, same) {
                if(err) return next(err);
                if(!same)  return res.status(401).send();

                res.json(user);  
            });
        });
});



//Creates a user, sets the Location header to "/", and returns no content
router.post('/users', (req, res, next) => {
    const newUser = req.body;
    User.create(newUser, function(err, course) {
        if(err){
            if(err.name === 'MongoError' && err.code === 11000) return next(new Error("Email address is already in use"));
            if(err.name === 'ValidationError') return res.status(400).send(err.message);
            return next(err);
        }

        res.location('/');
        res.status(204).send();
    });
});

//Returns a list of courses (including the user that owns each course)
router.get('/courses', (req, res, next) => {
    Course
        .find({})
        .populate('user', ['firstName', 'lastName'])
        .exec( function(err, courses) {
            if(err) return next(err);
            res.json(courses);
        });
});


// Returns a specific course (including the users name that owns the course)
router.get('/courses/:id', (req, res, next) => {
    Course
        .findById(req.params.id)
        .populate('user', ['firstName', 'lastName'])
        .exec( function(err, course) {
            if(err) return next(err);
            res.json(course);
        });
});

//Creates a course, sets the Location header to the URI for the course, and returns no content
router.post('/courses', (req, res, next) => {
    const credentials = auth(req);
    
    if(!credentials) return res.status(401).send();
    
    User
    .findOne({emailAddress: credentials.name})
    .exec(function(err, user) {
        if(err) return next (err);
        if(!user) return res.status(401).send();

        bcrypt.compare(credentials.pass, user.password, function(err, same) {
            if(err) return next(err);
            if(!same)  return res.status(401).send();
        
         
            req.body.user = user._id;
            const newCourse = req.body;

            Course.create(newCourse, function(err, course) {
                if(err){
                    if(err.name === 'ValidationError') return res.status(400).send(err.message);
                    return next(err);
                }
                res.location(`localhost:5000/api/courses/${course._id}`);
                res.status(204).send();
            }); 
        });
    });    
});


//Updates a course if the user has authorizaton and returns no content
router.put('/courses/:id', (req, res, next) => {
    Course
        .findById(req.params.id)
        .populate('user')
        .exec(function(err, course) {
            if(err){
                if(err.name === 'ValidationError') return res.status(400).send(err.message);
                return next(err);
            }
            
            const credentials = auth(req);

            if(!credentials) {
                return res.status(403).send();
            }

            if(course.user.emailAddress !== credentials.name) {
                return res.status(403).send();
            }
            bcrypt.compare(credentials.pass, course.user.password, function(err, same) {
                if(err) return next(err);
                if(!same)  return res.status(403).send();

                course.set(req.body);
                course.save(function (err, updatedCourse) {
                    if(err) return next(err);
                    res.status(204).send();
                });
            });
        });
});

//Deletes a course if the user has authorization and returns no content
router.delete('/courses/:id', (req, res, next) => {
    Course
        .findById(req.params.id)
        .populate('user')
        .exec(function(err, course) {
            if(err) return next(err);
            
            const credentials = auth(req);
    
            if(!credentials) {
                return res.status(403).send();
            }
    
            if(course.user.emailAddress !== credentials.name) {
                return  res.status(403).send();
            }

            bcrypt.compare(credentials.pass, course.user.password, function(err, same) {
                if(err) return next(err);
                if(same) {
                    course.remove()
                    res.status(204).send();
                } else {
                    res.status(403).send() 
                }    
            });
    });
});

module.exports = router;