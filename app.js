const express = require("express");
const mongoose = require("mongoose");
const _ = require("lodash");

const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({extended: true}));
app.use(express.static("public"));

main().catch(function(err) {
  console.log(err);
})

async function main() {
  await mongoose.connect("mongodb://localhost:27017/todoListDB");
}

const itemsSchema = new mongoose.Schema({
  name: "String"
});

const Item = mongoose.model("item", itemsSchema);

const listSchema = new mongoose.Schema({
  name: String,
  items : [itemsSchema]
});

const List = mongoose.model("list", listSchema);

app.get("/", function(req, res) {

  Item.find(function(err, foundItems) {
    List.find(function(err, result) {
      res.render("home", {listTitle: "Today", newListItems: foundItems, listsNameArr : result});
    });
  });
});

app.post("/delete", function(req, res) {
  const checkedItemId = req.body.checkbox;
  const listName = req.body.listName;
  if(listName === "Today"){
    Item.findByIdAndRemove(checkedItemId, function(err) {
      if(err){
        console.log(err);
      }else{
        res.redirect("/");
      }
    });
  }else{
    List.findOneAndUpdate({name : listName}, {$pull : {items: {_id: checkedItemId}}}, function(err, result) {
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
  List.deleteOne({name : listname}, function(err, result) {
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
  if(req.body.list === "Today"){
    if(newItemAdded !== ""){
      const newItem = new Item({
        name : newItemAdded
      });
      newItem.save();
    }
    res.redirect("/");
  }else{
    List.findOne({name: listName}, function(err, result) {
      if(err){
        console.log(err);
      }else{
        if(newItemAdded !== ""){
          const newItem = new Item({
            name : newItemAdded
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

app.get("/:topic", function(req, res) {
  const customListName = _.capitalize(req.params.topic);
  if(customListName === "Favicon.ico") {
    return;
  }
  List.findOne({name : customListName}, function(err,result) {
    if(err){
      console.log(err);
    }else{
      if(!result){
        const list = new List({
          name: customListName,
          items : []
        });
        list.save(function() {
          res.redirect("/"+customListName);
        });
      }else{
        List.find(function(err, listsNameArr) {
          res.render("list", {listTitle: result.name, newListItems: result.items, listsNameArr : listsNameArr});
        });
      }
    }
  });
});

app.post("/create", function(req, res) {
  const listName = req.body.listName;
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
      List.findOne({name : customListName}, function(err,result) {
        if(err){
          console.log(err);
        }else{
          if(!result){
            const list = new List({
              name: customListName,
              items : []
            });
            list.save(function() {
              res.redirect("/"+customListName);
            });
          }else{
            List.find(function(err, listsNameArr) {
              res.render("list", {listTitle: result.name, newListItems: result.items, listsNameArr : listsNameArr});
            });
          }
        }
      });
    }
  }
});

app.listen(3000, function() {
  console.log("The server is running on port 3000.");
});
