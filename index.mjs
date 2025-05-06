import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import session from 'express-session';

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

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

//routes
app.get('/', (req, res) => {
     if(req.session.userAuthenticated){
         res.redirect('/home');
    }else{
         res.render('login.ejs', {isAuthenticated: false});
    }
  });

  app.get('/home', isAuthenticate, (req, res) => {
     res.render('home.ejs', {fullName: req.session.fullName});
  });

 app.get('/logout', (req, res) => {
     req.session.destroy();
     res.render('login.ejs', {isAuthenticated: false});
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
