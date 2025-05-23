const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Device = require("./models/Device");
const Plant = require("./models/Planet");
const QRCode = require("qrcode");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(
  "mongodb+srv://amreahmed:MARTIN123martin@cluster0.7vqsuyo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

// Register a new device
app.post("/register-device", async (req, res) => {
  const { name, uuid, wifiSSID, wifiPassword } = req.body;
  try {
    const newDevice = new Device({ name, uuid, wifiSSID, wifiPassword });
    await newDevice.save();
    res.status(201).json({ message: "Device registered" });
  } catch (err) {
    res.status(500).json({ message: "Error registering device", error: err });
  }
});

// Get all plants
app.get("/plants", async (req, res) => {
  try {
    const plants = await Plant.find(); // Fetch all plants from the database
    res.json(plants); // Send the list of plants as the response
  } catch (err) {
    res.status(500).json({ message: "Error fetching plants", error: err });
  }
});


// Get device by UUID
// Get device by UUID with associated plant data
app.get("/device/:uuid", async (req, res) => {
  const { uuid } = req.params;
  try {
    const device = await Device.findOne({ uuid }).populate("assignedPlant");

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    const plant = device.assignedPlant;

    if (!plant) {
      return res.json({ uuid: device.uuid, name: device.name, assignedPlant: null });
    }

    const { moisture, light, temperature } = device.sensorData || {};
   

    // Status Logic
 const { defaultTemp, defaultLight, defaultSoil } = plant;

 const status = {
   moisture: moisture < defaultSoil.min ? "Needs Water" : moisture > defaultSoil.max ? "Too Wet" : "Moisture OK",

   light: light < defaultLight.min ? "Needs More Light" : light > defaultLight.max ? "Too Bright" : "Light OK",

   temperature:
     temperature < defaultTemp.min ? "Too Cold" : temperature > defaultTemp.max ? "Too Hot" : "Temperature OK",
 };


    const deviceData = {
      uuid: device.uuid,
      name: device.name,
      sensorData: {
        moisture,
        light,
        temperature,
      },
      assignedPlant: {
        name: plant.name,
        photo: plant.photo,
        description: plant.description,
        defaultTemp,
        defaultLight,
        defaultSoil,
      },
      status, // <- include this new field
    };

    res.json(deviceData);
  } catch (err) {
    res.status(500).json({ message: "Error fetching device", error: err });
  }
});


// Generate QR code for pot ID
app.get("/generate-qr/:potId", (req, res) => {
  const potId = req.params.potId;

  QRCode.toDataURL(potId, (err, url) => {
    if (err) {
      return res.status(500).send("Error generating QR code");
    }
    res.send(`<img src="${url}" />`);
  });
});





app.post("/add", async (req, res) => {
  const { name, defaultTemp, defaultLight, defaultSoil, description, photo } = req.body;

  const plant = new Plant({
    name,
    defaultTemp, // { min: 15, max: 30 }
    defaultLight, // { min: 200, max: 1000 }
    defaultSoil, // { min: 30, max: 70 }
    description,
    photo,
  });

  await plant.save();
  res.json({ success: true, plant });
});



// Assign a plant to a device
app.post("/assign-plant", async (req, res) => {
  const { uuid, plantId } = req.body;

  try {
    const plant = await Plant.findById(plantId);
    if (!plant) return res.status(404).json({ message: "Plant not found" });

    const device = await Device.findOneAndUpdate({ uuid }, { $set: { assignedPlant: plantId } }, { new: true });

    if (!device) return res.status(404).json({ message: "Device not found" });

    res.json({ message: "Plant assigned", device });
  } catch (err) {
    res.status(500).json({ message: "Error assigning plant", error: err });
  }
});



// Update sensor data from ESP32
app.post("/update-data", async (req, res) => {
  const { uuid, moisture, light } = req.body;

  if (!uuid || moisture == null || light == null) {
    return res.status(400).json({ message: "Missing data" });
  }

  try {
    const device = await Device.findOneAndUpdate(
      { uuid },
      {
        $set: {
          "sensorData.moisture": moisture,
          "sensorData.light": light,
          "sensorData.timestamp": new Date(),
        },
      },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    res.json({ message: "Data updated", device });
  } catch (err) {
    res.status(500).json({ message: "Failed to update data", error: err });
  }
});

// Update device name by UUID
app.post("/update-name", async (req, res) => {
  const { uuid, newName } = req.body;

  if (!uuid || !newName) {
    return res.status(400).json({ message: "Missing uuid or newName" });
  }

  try {
    const device = await Device.findOneAndUpdate(
      { uuid },
      { $set: { name: newName } },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    res.json({ message: "Device name updated", device });
  } catch (err) {
    res.status(500).json({ message: "Error updating device name", error: err });
  }
});


app.listen(3000, () => console.log("API running on http://localhost:3000"));
