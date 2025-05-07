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
  app.use((req, res, next) => {
    res.locals.isAuthenticated = !!req.session.user;
    next();
  });
//routes
app.get('/', (req, res) => {
  if (req.session.user) {
    res.render('addPet', { error: null });
  } else {
    res.redirect('/login');
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

  app.get('/login', (req, res) => {
    res.render('login', { error: null });
  });

  app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const conn = await pool.getConnection();
  
    try {
      const [users] = await conn.execute(
        'SELECT * FROM Admin WHERE username = ?',
        [username]
      );
  
      if (users.length === 0) {
        return res.render('login', { error: 'User not found' });
      }
  
      const hash = users[0].Password;
  
      if (!hash || !(await bcrypt.compare(password, hash))) {
        return res.render('login', { error: 'Incorrect password' });
      }
  
      req.session.user = username;
      res.redirect('/about');
    } catch (err) {
      console.error(err);
      res.render('login', { error: 'An error occurred. Please try again.' });
    } finally {
      conn.release();
    }
  });

  app.get('/about', (req, res) => {
    res.render('about');
  });

  app.get('/contact', (req, res) => {
    res.render('contact');
  });

  app.post('/add-pet', async (req, res) => {
    const {
      name, breed, type, age, gender,
      size, description, status, url, image_url
    } = req.body;
  
    try {
      const conn = await pool.getConnection();
  
      await conn.execute(
        `INSERT INTO pets 
          (name, breed, type, age, gender, size, description, status, url, image_url, last_update) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [name, breed, type, age, gender, size, description, status, url, image_url]
      );
  
      conn.release();
      res.render('addPet', { error: 'Pet added successfully!' });
    } catch (err) {
      console.error(err);
      res.render('addPet', { error: 'Error adding pet. Please try again.' });
    }
  });
  
  
  

  //dbTest
  app.get("/dbTest", async(req, res) => {
      let sql = "SELECT CURDATE()";
      const [rows] = await conn.query(sql);
      res.send(rows);
  });

  app.get('/results', async (req, res) => {
    const { type = 'dog', breed = '' } = req.query;
  
    try {
      const token = await getAccessToken();
      let query = `https://api.petfinder.com/v2/animals?type=${type}&limit=20`;
  
      if (breed) {
        query += `&breed=${encodeURIComponent(breed)}`;
      }
  
      const response = await fetch(query, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
  
      const data = await response.json();
      res.render('results', { pets: data.animals, type, breed });
    } catch (err) {
      console.error(err);
      res.render('results', { pets: [], type: '', breed: '' });
    }
  });
  
  
  // Sign Up Page
app.get('/signup', (req, res) => {
  res.render('signUp');
});

// Handle Sign Up Submission
app.post('/signup', async (req, res) => {
  const { username, password, phone } = req.body;

  try {
    const conn = await pool.getConnection();

    const [existing] = await conn.execute(
      'SELECT * FROM Admin WHERE username = ?',
      [username]
    );

    if (existing.length > 0) {
      res.render('signUp', { error: 'Username already exists.' });
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      await conn.execute(
        'INSERT INTO Admin (`username`, `password`, `Phone Number`) VALUES (?, ?, ?)',
        [username, hashedPassword, phone]
      );
      res.render('login', { error: null });

    }

    conn.release();
  } catch (err) {
    console.error(err);
    res.render('signUp', { error: 'An error occurred. Please try again.' });
  }
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
