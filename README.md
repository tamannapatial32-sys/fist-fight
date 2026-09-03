# Teachable Machine Model Directory

Place your exported Google Teachable Machine files here:

1. `model.json`
2. `metadata.json`
3. `weights.bin`

---

## How to Train Your Model on Google Teachable Machine:

1. Go to [https://teachablemachine.withgoogle.com/train/image](https://teachablemachine.withgoogle.com/train/image)
2. Create 3 classes:
   - **Class 1**: `Punch` or `Fist` (Hold your clenched fist towards the camera, record 50-100 webcam samples).
   - **Class 2**: `Block` or `Open Hand` (Hold open hands/palms up in front of your chest/face like a boxing guard, record samples).
   - **Class 3**: `Idle` or `Neutral` (Sit normally in front of the camera, hands down/relaxed, record samples).
3. Click **Train Model**.
4. Click **Export Model**:
   - **Option A (Cloud URL)**: Select "Upload (shareable link)", copy the link, and paste it into the Fist Fight settings modal.
   - **Option B (Download)**: Select "TensorFlow.js" -> "Download", extract the 3 files (`model.json`, `metadata.json`, `weights.bin`), and place them in this `./my_model/` folder.
   - **Option C (File Picker)**: Open Fist Fight in your browser and click "Model / Settings" -> "Upload Exported Model Files Directly".
