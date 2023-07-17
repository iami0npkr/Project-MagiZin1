//jshint esversion:6
// @ts-ignore
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const localStrategy = require("passport-local");
const passportLocalMongoose = require("passport-local-mongoose");
//const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");
const { ObjectId } = require('bson');
const https = require("https");
const alert = require('alert');
// @ts-ignore
//const flash = require("connect-flash");

// flash variable
//const flash = require('connect-flash');
// const { flash } = require('express-flash-message');




const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.set('strictQuery', true);
mongoose.connect(process.env.MONGODB_CONNECT_URI, { useNewUrlParser: true });

 
const articleSchema = new mongoose.Schema({
    title: String,
    content: String,
    author:String,
    place: String,
    category: String,
    createdAt: String,
    likeCount: { type: Number, default: 0 },
  });

 const announcementSchema = new mongoose.Schema({
    announcement: String,
    announcer: String,
    createdAt: String
 }) 
  

 const userSchema = new mongoose.Schema({
  fullname: String,
  department: String,
  username: String,
  password: String,
  googleId: String,
  articles: [articleSchema],
  likedArticles: [{ type: ObjectId }],
  announcements: [announcementSchema]
});

userSchema.pre('save', function (next) {
  const maxAnnouncements = 3; // Maximum number of announcements allowed per user

  if (this.announcements.length > maxAnnouncements) {
    this.announcements.shift(); // Remove the oldest announcement from the beginning of the array
  }

  next();
});


// const Article = mongoose.model('Article', articleSchema);
//plugin for passport
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(new localStrategy(User.authenticate()));
// serialize and deserialize the user for passport session support
passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    })
});

// passport.use(new GoogleStrategy(
//     {
//         clientID: process.env.CLIENT_ID,
//         clientSecret: process.env.CLIENT_SECRET,
//         callbackURL: "http://localhost:3000/auth/google/user",
//         //userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
//         // passReqToCallback: true
//     },
//     function (req, accessToken, refreshToken, profile, cb) {
//         console.log(accessToken);
//         console.log(refreshToken);
//         console.log(profile);

//         User.findOrCreate({ googleId: profile.id }, function (err, user) {
//             if (err) {
//                 return cb(err);
//             }
//             // Update the fullname property with displayName from the Google profile
//             user.fullname = profile.displayName;
//             user.save(function (err) {
//                 return cb(err, user);
//             });
//         });
//     }
// ));
app.get("/about",function(req,res){
  res.render("about");
})
app.get("/termsOfUse",function(req,res){
  res.render("termsOfUse");
})
app.get("/test",function(req,res){
    res.render("test");
})

app.get('/', function(req, res) {
  User.find({ "announcements": { $exists: true, $ne: [] } }, function (err, foundUsers) {
    if (err) {
      console.log(err);
    } else {
       
      res.render("home", { usersWithAnnouncements: foundUsers });
        
    }
  });
});
app.get("/allAnnouncements",isAuthenticated,function(req,res){
    User.find({ "announcements": { $exists: true, $ne: [] } }, function (err, foundUsers) {
        if (err) {
          console.log(err);
        } else {
           
          res.render("allAnnouncements", { usersWithAnnouncements: foundUsers });
            
        }
      });
})
app.post("/search",isAuthenticated,function(req,res){
    //flash
    //req.flash('success', 'This is a flash message using the express-flash module.');
    const word=req.body.define;
    const url="https://api.dictionaryapi.dev/api/v2/entries/en/"+word;
    https.get(url,function(response){
        const status=response.statusCode;
        if(status===200){
            response.on("data",function(data){
              var wordExample="not available";
                const wordData=JSON.parse(data);
                const phonetic=wordData[0].phonetic;
                const wordOrigin=wordData[0].origin;
                const meanings=wordData[0].meanings;
                
                res.render("search",{word:word,wordOrigin:wordOrigin,pronunciation:phonetic,meanings:meanings});
            })
        }
        else{
            res.render("search",{word:word,wordOrigin:"word do not exist",pronunciation:"as you wish",meanings:[]});
        }
    })
   // res.render("test");
})


// app.get("/auth/google",
//     passport.authenticate("google", { scope: ["profile"] })
// );
// app.get("/auth/google/user",
//     passport.authenticate("google", { failureRedirect: "/login" }),
//     function (req, res) {
//         // Successful authentication, redirect to articles.
//         res.redirect("/user");
//     }
// );
app.get("/login", function (req, res) {
    res.render("login");
})
app.get("/register", function (req, res) {
    res.render("register");
})
app.get("/user", function(req, res) {
    if (req.isAuthenticated()) {
      const userId = req.user._id;
      User.findById(userId, function(err, foundUser) {
        if (err) {
          console.log(err);
        } else {
          if (foundUser) {
            User.find({ "articles": { $exists: true, $ne: [] } }, function(err, foundUsers) {
              if (err) {
                console.log(err);
              } else {
                if (foundUsers) {
                  // Collect all articles of all users
                  const allArticles = [];
                  foundUsers.forEach(function(user) {
                    allArticles.push(...user.articles);
                  });
  
                  res.render("user", { usersWithArticles: foundUsers, userId: userId, user: foundUser, articles: allArticles });
                }
              }
            });
          } else {
            res.redirect("/"); // Handle user not found
          }
        }
      });
    } else {
      res.redirect("/login");
    }
  });
  app.post('/updatePassword/:userId', function (req, res) {
    const userId = req.params.userId;
  
    User.findById(userId, (err, user) => {
      if (err) {
        res.send(err);
      } else {
        user.changePassword(req.body.oldPassword, req.body.newPassword, function (err) {
          if (err) {
            res.send(err);
          } else {
            res.render("changeSuccess");
          }
        });
      }
    });
  });
  app.post('/announce/:userId', function (req, res) {
    const userId = req.params.userId;
    const { announcement, announcer } = req.body;
    const datetime = new Date();
    const createdAt= datetime.toLocaleString()
  
    // Find the user by their ID
    User.findById(userId, function (err, user) {
      if (err) {
        console.log(err);
        res.send('An error occurred while finding the user.');
      } else {
        // Add the announcement to the user's announcements array
        user.announcements.push({ announcement, announcer,createdAt });
        // Save the updated user
        user.save(function (err) {
          if (err) {
            console.log(err);
            res.send('An error occurred while saving the user.');
          } else {
            res.send('Announcement added successfully.');
          }
        });
      }
    });
  });
  
  
  

// Middleware for checking if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      // User is authenticated, proceed to the next middleware/route handler
      return next();
    }
    // User is not authenticated, redirect them to the login page
    res.redirect("/login");
  }
  
  app.get("/edit/:articleId", isAuthenticated, function(req, res) {
    const userId = req.user.id;
    const articleId = req.params.articleId;
    
    User.findById(userId, function(err, foundUser) {
      if (err) {
        console.log(err);
      } else {
        const article = foundUser.articles.id(articleId);
        if (!article) {
          // Article not found for the user
          return res.redirect("/user");
        }
        res.render("edit", { article: article });
      }
    });
  });
  
  app.get("/delete/:articleId", isAuthenticated, function(req, res) {
    const userId = req.user.id;
    const articleId = req.params.articleId;
    
    User.findById(userId, function(err, foundUser) {
      if (err) {
        console.log(err);
      } else {
        const article = foundUser.articles.id(articleId);
        if (!article) {
          // Article not found for the user
          return res.redirect("/user");
        }
        article.remove();
        foundUser.save(function(err) {
          if (err) {
            console.log(err);
          } else {
            res.redirect("/user"); // Redirect to user's articles page
          }
        });
      }
    });
  });
  app.post("/update/:articleId", isAuthenticated, function(req, res) {
    const userId = req.user.id;
    const articleId = req.params.articleId;
    const { title, content, place } = req.body;
    
    User.findById(userId, function(err, foundUser) {
      if (err) {
        console.log(err);
      } else {
        const article = foundUser.articles.id(articleId);
        if (!article) {
          // Article not found for the user
          return res.redirect("/user");
        }
        
        // Update the article properties
        article.title = title;
        article.content = content;
        article.place = place;
        
        foundUser.save(function(err) {
          if (err) {
            console.log(err);
          } else {
            res.redirect("/user"); // Redirect to user's articles page
          }
        });
      }
    });
  });
  // Edit Announcement
app.get('/editAnnouncement/:announcementId',isAuthenticated, (req, res) => {
    console.log(req)
    const userId = req.user.id;
    const announcementId = req.params.announcementId;
    // Fetch the announcement from the database using the announcementId
    // Render the edit announcement form with the fetched announcement data
    User.findById(userId, function(err, foundUser) {

        if (err) {
          console.log(err);
        } else {
          const announcement = foundUser.announcements.id(announcementId);
          if (!announcement) {
            // Article not found for the user
            return res.redirect("/user");
          }
          res.render("editAnnouncement", { announcement: announcement ,announcementId:announcementId});
        }
      });
  });
  // Update Announcement
  app.post('/updateAnnouncement/:announcementId',isAuthenticated, (req, res) => {
    const userId = req.user.id;
    const announcementId = req.params.announcementId;
    const updatedAnnouncement = req.body.announcement;
    // Update the announcement in the database with the updatedAnnouncement
    // Redirect to the user's profile page or any other desired location
    User.findById(userId, function(err, foundUser) {
        if (err) {
          console.log(err);
        } else {
          const announcement = foundUser.announcements.id(announcementId);
          if (!announcement) {
            // Article not found for the user
            return res.redirect("/user");
          }
          
          // Update the article properties
           announcement.announcement= updatedAnnouncement;
          
          foundUser.save(function(err) {
            if (err) {
              console.log(err);
            } else {
              res.redirect("/user"); // Redirect to user's articles page
            }
          });
        }
      });
  
  });
 
  
  // Delete Announcement
  app.get('/deleteAnnouncement/:announcementId', (req, res) => {
    const announcementId = req.params.announcementId;
    // Delete the announcement from the database using the announcementId
    // Redirect to the user's profile page or any other desired location
    res.redirect('/profile');
  });
  
  
  

app.get("/articles", function (req, res) {
    User.find({ "articles": { $exists: true, $ne: [] } }, function (err, foundUsers) {
        if (err) {
            console.log(err);
        } else {
            if (foundUsers) {
                console.log(foundUsers);
                res.render("articles", { usersWithArticles: foundUsers });
            }
        }
    });
});

 
app.get("/topics",function(req,res){
  res.render("topics");
})
app.get("/topics1",function(req,res){
  res.render("topics1");
})
app.post("/submit",isAuthenticated, function (req, res) {
    console.log(req.user.id);
    User.findById(req.user.id, function (err, foundUser) {
        if (err) {
            console.log(err);
        } else {
            if (foundUser) {
                const datetime = new Date();
                const newArticle = {
                    title: req.body.title,
                    content: req.body.content,
                    author: foundUser.fullname,
                    place: req.body.place,
                    category: req.body.category,
                    createdAt: datetime.toLocaleString()

                };
                foundUser.articles.push(newArticle);
                foundUser.save(function (err) {
                    if (err) {
                        console.log(err);
                    } else {
                        res.redirect("/user");
                    }
                });
            }
        }
    });
});
app.get("/like/:articleId",isAuthenticated, function (req, res) {
    const userId = req.user.id;
    const requestedArticleId = req.params.articleId;
    //find requestedArticleId in req.user.likedArticles in user details
     
    if(req.isAuthenticated()){
        User.findById(req.user.id, function (err, foundUser) {
            if (err) {
                console.log(err);
            } else {
                if (foundUser) {
                    const article = foundUser.likedArticles.find(
                        article => article._id.toString() === requestedArticleId
                    );
                    if (!!article){
                        //remove the requestedArticleId from foundUser.likedArticles
                        foundUser.likedArticles = foundUser.likedArticles.filter(
                            article => article._id.toString() !== requestedArticleId
                        );
                        foundUser.save(function (err) {
                            if (err) {
                                console.log(err);
                            } else {
                                User.findOne({ "articles._id": requestedArticleId }, function (err, foundUser) {
                                    if (err) {
                                        console.log(err);
                                    } else {
                                        if (foundUser) {
                                            const article = foundUser.articles.id(requestedArticleId);
                                            if (!article) {
                                                // Article not found for the user
                                                return res.redirect("/user");
                                              }
                                              
                                              // Update the article properties
                                                article.likeCount = article.likeCount - 1;
                                              
                                              foundUser.save(function(err) {
                                                if (err) {
                                                  console.log(err);
                                                } else {
                                                   // now render the present article page with the changes in like button
                                                    res.redirect("/article/"+requestedArticleId);
                                                    

                                                }
                                              });``
                                        }
                                    }
                                });
                            }
                        }
                        );

                    }
                    else{
                        //add requestedArticleId to foundUser.likedArticles
                        foundUser.likedArticles.push(requestedArticleId);
                        foundUser.save(function (err) {
                            if (err) {
                                console.log(err);
                            } else {
                                User.findOne({ "articles._id": requestedArticleId }, function (err, foundUser) {
                                    if (err) {
                                        console.log(err);
                                    } else {
                                        if (foundUser) {
                                            const article = foundUser.articles.id(requestedArticleId);
                                            if (!article) {
                                                // Article not found for the user
                                                return res.redirect("/user");
                                              }
                                              
                                              // Update the article properties
                                                article.likeCount = article.likeCount + 1;
                                              
                                              foundUser.save(function(err) {
                                                if (err) {
                                                  console.log(err);
                                                } else {
                                                    res.redirect("/article/"+requestedArticleId);
                                                }
                                              });
                                              
                                           
                                        } else {
                                            console.log("User not found.");
                                            res.redirect("/articles");
                                        }
                                    }
                                });
                            }
                        }
                        )
                    }
                }
            }
        });
    }


    
});
app.get("/article/:articleId", function (req, res) {
    const requestedArticleId = req.params.articleId;
    //find requestedArticleId in req.user.likedArticles in user details
    let likeStatus="Like"
    if(req.isAuthenticated()){
        User.findById(req.user.id, function (err, foundUser) {
            if (err) {
                console.log(err);
            } else {
                if (foundUser) {
                    const article = foundUser.likedArticles.find(
                        article => article._id.toString() === requestedArticleId
                    );
                    if (!!article){
                        likeStatus="Liked"
                    }
                }
            }
        });
    }
     User.findOne({ "articles._id": requestedArticleId }, function (err, foundUser) {
        if (err) {
            console.log(err);
        } else {
            if (foundUser) {
                const requestedArticle = foundUser.articles.find(
                    article => article._id.toString() === requestedArticleId
                );

                if (requestedArticle) {
                    res.render("article", {
                        title: requestedArticle.title,
                        content: requestedArticle.content,
                        place: requestedArticle.place,
                        category: requestedArticle.category,
                        createdAt: requestedArticle.createdAt,
                        likeCount: requestedArticle.likeCount,
                        author: requestedArticle.author,
                        id:requestedArticleId,
                        like:likeStatus,
                         
                    });
                } else {
                    console.log("Article not found.");
                    res.redirect("/articles");
                }
            } else {
                console.log("User not found.");
                res.redirect("/articles");
            }
        }
    });
});
app.get("/articles/categoryA",isAuthenticated, function (req, res) {
    // Find all users with articles of category A
    User.find({ "articles.category": "A" }, function (err, foundUsers) {
        if (err) {
            console.log(err);
        } else {
            // Array to store articles of category A
            const categoryAarticles = [];

            // Iterate over each found user
            foundUsers.forEach(function (user) {
                // Find articles of category A for the user
                const articlesOfCategoryA = user.articles.filter(function (article) {
                    return article.category === "A";
                });

                // Add articles to the categoryAarticles array
                categoryAarticles.push(...articlesOfCategoryA);
            });

            res.render("categoryA", { articles: categoryAarticles });
        }
    });
});
app.get("/articles/categoryB",isAuthenticated, function (req, res) {
    // Find all users with articles of category B
    User.find({ "articles.category": "B" }, function (err, foundUsers) {
        if (err) {
            console.log(err);
        } else {
            // Array to store articles of category B
            const categoryBarticles = [];
            // Iterate over each found user
            foundUsers.forEach(function (user) {
                // Find articles of category B for the user
                const articlesOfCategoryB = user.articles.filter(function (article) {
                    return article.category === "B";
                });
                // Add articles to the categoryBarticles array
                categoryBarticles.push(...articlesOfCategoryB);
            });
            res.render("categoryB", { articles: categoryBarticles });
        }
    });
});
app.get("/articles/categoryC",isAuthenticated, function (req, res) {
    // Find all users with articles of category C
    User.find({ "articles.category": "C" }, function (err, foundUsers) {
        if (err) {
            console.log(err);
        } else {
            // Array to store articles of category C
            const categoryCarticles = [];
            // Iterate over each found user
            foundUsers.forEach(function (user) {
                // Find articles of category C for the user
                const articlesOfCategoryC = user.articles.filter(function (article) {
                    return article.category === "C";
                });
                // Add articles to the categoryCarticles array
                categoryCarticles.push(...articlesOfCategoryC);
            });
            res.render("categoryC", { articles: categoryCarticles });
        }
    });
});
app.get("/articles/categoryD",isAuthenticated, function (req, res) {
    // Find all users with articles of category D
    User.find({ "articles.category": "D" }, function (err, foundUsers) {
        if (err) {
            console.log(err);
        } else {
            // Array to store articles of category D
            const categoryDarticles = [];
            // Iterate over each found user
            foundUsers.forEach(function (user) {
                // Find articles of category D for the user
                const articlesOfCategoryD = user.articles.filter(function (article) {
                    return article.category === "D";
                });
                // Add articles to the categoryDarticles array
                categoryDarticles.push(...articlesOfCategoryD);
            });
            res.render("categoryD", { articles: categoryDarticles });
        }
    });
});
app.get("/articles/categoryE",isAuthenticated, function (req, res) {
    // Find all users with articles of category E
    User.find({ "articles.category": "E" }, function (err, foundUsers) {
        if (err) {
            console.log(err);
        } else {
            // Array to store articles of category E
            const categoryEarticles = [];
            // Iterate over each found user
            foundUsers.forEach(function (user) {
                // Find articles of category E for the user
                const articlesOfCategoryE = user.articles.filter(function (article) {
                    return article.category === "E";
                });
                // Add articles to the categoryEarticles array
                categoryEarticles.push(...articlesOfCategoryE);
            });
            res.render("categoryE", { articles: categoryEarticles });
        }
    });
});





app.get('/logout', function (req, res, next) {
    req.logout(function (err) {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

app.post("/register", function (req, res) {
  const newUser = new User({
      fullname: req.body.fullname,
      department: req.body.department,
      username: req.body.username,
  })
  User.register(newUser, req.body.password, function (err, user) {
      if (err) {
          if (err.name === "UserExistsError") {
              // Render the "User Exists" page
              return res.render("userExists");
          }
          console.log(err);
          res.redirect("/register");
      } else {
          passport.authenticate("local")(req, res, function () {
              res.redirect("/login");
          });
      }
  });
});

app.post("/login", function (req, res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });
    req.login(user, function (err) {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local",{failureRedirect:'/wrong',failureMessage:true})(req, res, function () {
                res.redirect("/user");
            });
        }
    });

})
app.get("/wrong",function(req,res){
  res.render("wrong");
})

const PORT = process.env.PORT;

app.listen(PORT, function () {
    console.log("Server started on port 3000");
}
);
