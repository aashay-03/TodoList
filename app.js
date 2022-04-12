require("dotenv").config()
const express = require("express");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const flash = require("connect-flash");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;
const findOrCreate = require("mongoose-findorcreate");
const moment = require("moment");
const _ = require("lodash");

const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({extended: true}));
app.use(express.static("public"));

app.use(session({
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());

app.use(function(req, res, next) {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error");
  next();
});

main().catch(function(err) {
  console.log(err);
})

async function main() {
  await mongoose.connect("mongodb://localhost:27017/todoListDB");
}

const userSchema = new mongoose.Schema({
  email : String,
  password : String,
  googleId : String,
  facebookId : String,
  githubId : String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("user", userSchema);

const itemsSchema = new mongoose.Schema({
  name: String,
  userId: String
});

const Item = mongoose.model("item", itemsSchema);

const listSchema = new mongoose.Schema({
  name: String,
  items : [itemsSchema],
  userId : String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const List = mongoose.model("list", listSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/today"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({  username: profile.emails[0].value, googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/today",
  },
  function(accessToken, refreshToken, profile, cb) {
    var userLoggedIn;
    if(typeof(profile.username) == 'undefined'){
      userLoggedIn = profile.displayName;
    }else{
      userLoggedIn = profile.username;
    }
    User.findOrCreate({ username: userLoggedIn, facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/github/today"
  },
  function(accessToken, refreshToken, profile, done) {
    User.findOrCreate({ username: profile.username, githubId: profile.id }, function (err, user) {
      return done(err, user);
    });
  }
));

app.get("/", checkAuthenticated, function(req, res) {
   const currUser = req.user._id;
   Item.find({userId : currUser}, function(err, foundItems) {
     List.find({userId : currUser}, function(err, result) {
      res.render("home", {listTitle: "Today", newListItems: foundItems, listsNameArr : result});
     });
   });
});

app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] }
));

app.get("/auth/google/today",
  passport.authenticate('google', { failureRedirect: '/login', failureFlash : true}),
  function(req, res) {
    res.redirect("/today");
  }
);

app.get('/auth/facebook',
  passport.authenticate('facebook', { scope: 'public_profile'}
));

app.get('/auth/facebook/today',
  passport.authenticate('facebook', { failureRedirect: '/login', failureFlash : true}),
  function(req, res) {
    res.redirect("/today");
  }
);

app.get('/auth/github',
  passport.authenticate('github', { scope: [ 'user:email' ] }
));

app.get('/auth/github/today',
  passport.authenticate('github', { failureRedirect: '/login', failureFlash : true}),
  function(req, res) {
  res.redirect("/today");
});

app.get("/login", ensureGuest, function(req, res) {
  res.render("login");
});

app.get("/register", ensureGuest, function(req, res) {
  res.render("register");
});

app.post("/delete", function(req, res) {
  const checkedItemId = req.body.checkbox;
  const listName = req.body.listName;
  const currUser = req.user._id;
  if(listName === "Today"){
    Item.findByIdAndRemove(checkedItemId, function(err) {
      if(err){
        console.log(err);
      }else{
        res.redirect("/");
      }
    });
  }else{
    List.findOneAndUpdate({name : listName, userId: currUser}, {$pull : {items: {_id: checkedItemId}}}, function(err, result) {
      if(err){
        console.log(err);
      }else{
        res.redirect("/" + listName);
      }
    });
  }
});

app.post("/deletelist", function(req, res) {
  const listname = req.body.listName;
  const currUser = req.user._id;
  List.deleteOne({name : listname, userId: currUser}, function(err, result) {
    if(err){
      console.log(err);
    }else{
      res.redirect("/");
    }
  });
});

app.post("/", function(req, res) {
  const newItemAdded = req.body.newItem;
  const listName = req.body.list;
  const currUser = req.user._id;
  if(req.body.list === "Today"){
    if(newItemAdded !== ""){
      const newItem = new Item({
        name : newItemAdded,
        userId : currUser
      });
      newItem.save();
    }
    res.redirect("/");
  }else{
    List.findOne({name: listName, userId: currUser}, function(err, result) {
      if(err){
        console.log(err);
      }else{
        if(newItemAdded !== ""){
          const newItem = new Item({
            name : newItemAdded,
            userId : currUser
          });
          result.items.push(newItem);
          result.save(function() {
            res.redirect("/" + listName);
          });
        }else{
          res.redirect("/" + listName);
        }
      }
    });
  }
});

app.get("/logout", ensureAuth, function(req, res) {
  req.logout();
  res.redirect("/login");
});

app.get("/:topic", ensureAuth, function(req, res) {
  const customListName = _.capitalize(req.params.topic);
  const currUser = req.user._id;
  if(customListName === "Favicon.ico") {
    return;
  }
  if(customListName === "Today"){
    res.redirect("/");
  }else{
    List.findOne({name : customListName, userId: currUser}, function(err,result) {
      if(err){
        console.log(err);
      }else{
        if(!result){
          const list = new List({
            name: customListName,
            items : [],
            userId: currUser
          });
          list.save(function() {
            res.redirect("/"+customListName);
          });
        }else{
          List.find({userId: currUser}, function(err, listsNameArr) {
            var fomatted_date = moment(result.createdAt).format("DD-MM-YYYY");
            var today = new Date();
            res.render("list", {listTitle: result.name, newListItems: result.items, listsNameArr : listsNameArr});
          });
        }
      }
    });
  }
});

app.post("/create", function(req, res) {
  const listName = req.body.listName;
  const currUser = req.user._id;
  if(req.body.newListName === ""){
    if(listName === "Today"){
      res.redirect("/");
    }else{
      res.redirect("/" + listName);
    }
  }else{
    const customListName = _.capitalize(req.body.newListName);
    if(customListName === "Today"){
      res.redirect("/");
    }else{
      List.findOne({name : customListName, userId: currUser}, function(err,result) {
        if(err){
          console.log(err);
        }else{
          if(!result){
            const list = new List({
              name: customListName,
              items : [],
              userId: currUser
            });
            list.save(function() {
              res.redirect("/"+customListName);
            });
          }else{
            List.find({userId: currUser}, function(err, listsNameArr) {
              res.render("list", {listTitle: result.name, newListItems: result.items, listsNameArr : listsNameArr});
            });
          }
        }
      });
    }
  }
});

app.post("/register", function(req, res) {
  const email = req.body.username;
  let errors = [];
  if(req.body.password.length < 6){
    errors.push({msg : "Password should be atleast 6 characters"});
  }
  if(req.body.password.length > 15){
    errors.push({msg : "Password should not exceed 15 characters"});
  }
  if(errors.length > 0){
    res.render("register", {errors, email});
  }else{
    User.register({username : req.body.username}, req.body.password, function(err, user) {
      if(err){
        errors.push({msg : "Email is already registered"})
        res.render("register", {errors, email});
      }else{
        passport.authenticate("local")(req, res, function() {
          res.redirect("/");
        });
      }
    });
  }
});

function ensureAuth(req, res, next) {
  if(req.isAuthenticated()) {
    return next()
  }else {
    req.flash("error_msg", "Please login to view this page");
    res.redirect("/login");
  }
}

function checkAuthenticated(req, res, next) {
  if(req.isAuthenticated()) {
    return next()
  }else {
    res.redirect("/register");
  }
}

function ensureGuest(req, res, next) {
  if(req.isAuthenticated()) {
    res.redirect("/");
  }else {
    return next()
  }
}

app.post("/login", passport.authenticate("local",{
  successRedirect: "/",
  failureRedirect: "/login",
  failureFlash : true
}));

app.listen(3000, function() {
  console.log("The server is running on port 3000.");
});
