import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import session from 'express-session';

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

const CLIENT_ID = `vG3QvobvScNhftDZmVNS7ODavIQkipb6xKiavPqiyuJlrJu0pf`;
const CLIENT_SECRET = `E7XNvOk6IFptMx5zGJnV6YF7CzM70hZ9jINflvjN`;
const NINJA_KEY = `qD7h3vQr/uCDaoX/kXND0g==tfsGYchxfiFYX3EV`;

//for Express to get values using POST method
app.use(express.urlencoded({extended:true}));

//session configuration
app.set('trust proxy', 1) // trust first proxy
app.use(session({
  secret: 'cst3336 csumb',
  resave: false,
  saveUninitialized: true
}));

//setting up database connection pool
 const pool = mysql.createPool({
     host: "saavedra-li.tech",
     user: "saavedr1_pet_user",
     password: "pet_database",
     database: "saavedr1_pet",    
     connectionLimit: 10,
     waitForConnections: true
 });
  const conn = await pool.getConnection();

  async function getAccessToken(){
    let response = await fetch(`https://api.petfinder.com/v2/oauth2/token`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            "grant_type": "client_credentials",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET
        })
    });
    let data = await response.json();
    return data.access_token;
  }

//routes
app.get('/', (req, res) => {
     if(req.session.userAuthenticated){
         res.redirect('/home');
    }else{
         res.render('login.ejs', {isAuthenticated: false});
    }
  });

  app.get('/api/pets', async(req, res) => {
    try {
        let token = await getAccessToken();
    
        let pet_response = await fetch('https://api.petfinder.com/v2/animals?limit=10', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        let data = await pet_response.json();
        res.json(data); // send JSON to frontend
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch animals from Petfinder' });
      }
  });

  app.get('/animals', async(req, res) => {
    let name = req.query.name || "cheetah"; //default to cheetah
    console.log("Requested name:", name);
    let response = await fetch(`https://api.api-ninjas.com/v1/animals?name=${name}`, {
    headers: {
      'X-Api-Key': NINJA_KEY
    }
  });

    const data = await response.json();
    console.log(data); // helpful for debugging
    res.json(data);
    if (data.length === 0) {
        return res.json({ message: "No animal found. Try something like 'cat', 'dog', or 'lion'." });
    }
  });

  app.get('/home', isAuthenticate, (req, res) => {
     res.render('home.ejs', {fullName: req.session.fullName});
  });

  app.get('/about', async(req, res) => {
    res.render('about.ejs', {fullName: req.session.fullName});
  });

 app.get('/logout', (req, res) => {
     req.session.destroy();
     res.render('login.ejs', {isAuthenticated: false});
  });

  app.get('/search', async(req, res) => {
    let animalTypes = ['Dog', 'Cat', 'Rabbit', 'Bird'];
    let breeds = ['Labrador', 'Persian', 'Dutch', 'Parrot'];
    res.render('search.ejs', { animalTypes, breeds });
  });

  app.get('/search-results', (req, res) => {
    let { animal_type, primary_breed } = req.query;
    res.send(`You searched for ${animal_type} of breed ${primary_breed}`);
  });

  app.post('/login', async(req, res) => {
     let username = req.body.username;
     let password = req.body.password;
     let hashedPassword;

     let sql = `SELECT * FROM admin WHERE username=?`;
     const [rows] = await conn.query(sql, [username]);
     if(rows.length > 0){
         hashedPassword = rows[0].password;
     }
     const match = await bcrypt.compare(password, hashedPassword);
     if(match){
         req.session.userAuthenticated = true;
         req.session.fullName = rows[0].firstName + " " + rows[0].lastName;
         res.render('home.ejs');
     }else{
         res.render('login.ejs', {"error": "Wrong credentials!"});
   }
  });

  //dbTest
  app.get("/dbTest", async(req, res) => {
      let sql = "SELECT CURDATE()";
      const [rows] = await conn.query(sql);
      res.send(rows);
  });

  app.get('/result', async (req, res) => {
    const { type } = req.query;
  
    let sql = `
      SELECT * FROM Pet 
      WHERE type LIKE ?
      LIMIT 50
    `;
  
    const [rows] = await conn.query(sql, [`%${type || ''}%`]);
  
    res.render('results.ejs', { pets: rows });
  });
  

  app.listen(3000, ()=>{
      console.log("Express server running")
  })
 
 //middleware to check if user is authenticated
 function isAuthenticate(req, res, next){
     if(req.session.userAuthenticated){
         next();
    }else{
         res.redirect('/');
    }
}
