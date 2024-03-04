import mongoose from "mongoose";
require('dotenv').config();

const db_url:string = process.env.DB_URL || "";

const connectDB = async()=>{
    try{
        await mongoose.connect(db_url).then((data: any) =>{
            console.log(`Database Connected with ${data.connection.host}`)
        })
    }
    catch(err:any){
        console.log(err.message);
        setTimeout(connectDB, 5000);
    }
}

export default connectDB;