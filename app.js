// =====================================
// Diploma Engineers Admin Panel
// app.js
// Part 10-1
// =====================================

import {
auth,
db,
signInWithEmailAndPassword,
signOut,
onAuthStateChanged,
ref,
push,
set,
update,
remove,
onValue
} from "./firebase.js";


// ======================
// Elements
// ======================

const loginPage = document.getElementById("loginPage");
const adminPanel = document.getElementById("adminPanel");

const loginForm = document.getElementById("loginForm");
const email = document.getElementById("email");
const password = document.getElementById("password");

const loginBtn = document.getElementById("loginBtn");

const logoutBtn = document.getElementById("logoutBtn");
const logoutBtn2 = document.getElementById("logoutBtn2");

const adminEmail = document.getElementById("adminEmail");

const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");

const pageTitle = document.getElementById("pageTitle");


// ======================
// Sidebar Menu
// ======================

document.querySelectorAll(".sidebar-menu li").forEach(item=>{

item.onclick=()=>{

document.querySelectorAll(".sidebar-menu li")
.forEach(li=>li.classList.remove("active"));

item.classList.add("active");

let page=item.dataset.page;

document.querySelectorAll(".page")
.forEach(p=>p.style.display="none");

document.getElementById(page+"Page").style.display="block";

pageTitle.innerHTML=item.innerText.trim();

};

});


// ======================
// Mobile Menu
// ======================

if(menuBtn){

menuBtn.onclick=()=>{

sidebar.classList.toggle("show");

};

}


// ======================
// Login
// ======================

loginForm.addEventListener("submit",async(e)=>{

e.preventDefault();

loginBtn.disabled=true;

loginBtn.innerHTML="Logging...";

try{

await signInWithEmailAndPassword(

auth,

email.value,

password.value

);

}catch(err){

alert(err.message);

}

loginBtn.disabled=false;

loginBtn.innerHTML="Login";

});


// ======================
// Logout
// ======================

function logout(){

signOut(auth);

}

logoutBtn.onclick=logout;

logoutBtn2.onclick=logout;


// ======================
// Auth State
// ======================

onAuthStateChanged(auth,user=>{

if(user){

loginPage.style.display="none";

adminPanel.style.display="block";

adminEmail.value=user.email;

}else{

loginPage.style.display="flex";

adminPanel.style.display="none";

}

});

// =====================================
// Part 10-2
// Cloudinary Upload + Semester Publish
// =====================================

// Cloudinary Config
const CLOUD_NAME = "YOUR_CLOUD_NAME";
const UPLOAD_PRESET = "YOUR_UPLOAD_PRESET";


// Upload PDF
async function uploadPDF(file){

const fd=new FormData();

fd.append("file",file);

fd.append("upload_preset",UPLOAD_PRESET);

const res=await fetch(

`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`,

{

method:"POST",

body:fd

}

);

const data=await res.json();

return data.secure_url;

}


// Upload Image
async function uploadImage(file){

const fd=new FormData();

fd.append("file",file);

fd.append("upload_preset",UPLOAD_PRESET);

const res=await fetch(

`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,

{

method:"POST",

body:fd

}

);

const data=await res.json();

return data.secure_url;

}



// ==========================
// Semester Publish
// ==========================

const publishSemester=document.getElementById("publishSemester");

publishSemester.onclick=async()=>{

const semester=document.getElementById("semester").value;

const subject=document.getElementById("subject").value;

const type=document.getElementById("type").value;

const pdf=document.getElementById("semesterPdf").files[0];

const link=document.getElementById("semesterLink").value;


if(!semester||!subject){

alert("Please fill all fields");

return;

}

publishSemester.disabled=true;

publishSemester.innerHTML="Publishing...";

let pdfURL="";

try{

if(pdf){

pdfURL=await uploadPDF(pdf);

}

const id=Date.now().toString();

await set(

ref(db,"semester/"+id),

{

semester,

subject,

type,

pdf:pdfURL,

link,

date:new Date().toLocaleString()

}

);

alert("Semester Published");

document.getElementById("semesterForm").reset();

}catch(err){

alert(err.message);

}

publishSemester.disabled=false;

publishSemester.innerHTML="Publish Semester";

};
// =====================================
// Part 10-3
// Semester Load + Delete
// =====================================

const semesterList = document.getElementById("semesterList");

// Load Semester Data
onValue(ref(db, "semester"), (snapshot) => {

semesterList.innerHTML = "";

if (!snapshot.exists()) {

semesterList.innerHTML = `
<tr>
<td colspan="5" class="text-center">
No Data Found
</td>
</tr>
`;

return;

}

snapshot.forEach((item) => {

const key = item.key;

const data = item.val();

semesterList.innerHTML += `

<tr>

<td>${data.semester}</td>

<td>${data.subject}</td>

<td>${data.type}</td>

<td>

${data.pdf ?

`<a href="${data.pdf}" target="_blank" class="btn btn-success btn-sm">

<i class="fa-solid fa-file-pdf"></i>

View

</a>`

:

"-"

}

</td>

<td>

<button
class="btn btn-danger btn-sm"
onclick="deleteSemester('${key}')">

<i class="fa-solid fa-trash"></i>

Delete

</button>

</td>

</tr>

`;

});

});


// ==========================
// Delete Semester
// ==========================

window.deleteSemester = async function(id){

if(!confirm("Delete this Semester?")) return;

try{

await remove(ref(db,"semester/"+id));

alert("Deleted Successfully");

}catch(err){

alert(err.message);

}

};


// ==========================
// Dashboard Count
// ==========================

onValue(ref(db,"semester"),(snapshot)=>{

document.getElementById("semesterCount").innerHTML=

snapshot.exists()

?

snapshot.size ||

Object.keys(snapshot.val()).length

:

0;

});

// =====================================
// Part 10-4
// Jobs Publish + Load + Delete
// =====================================

const publishJob = document.getElementById("publishJob");
const jobsList = document.getElementById("jobsList");

// ==========================
// Publish Job
// ==========================

publishJob.onclick = async () => {

const title = document.getElementById("jobTitle").value;

const company = document.getElementById("company").value;

const image = document.getElementById("jobImage").files[0];

const link = document.getElementById("jobLink").value;

const lastDate = document.getElementById("lastDate").value;

if(!title || !company){

alert("Please fill all fields");

return;

}

publishJob.disabled = true;

publishJob.innerHTML = "Publishing...";

let imageURL = "";

try{

if(image){

imageURL = await uploadImage(image);

}

const id = Date.now().toString();

await set(

ref(db,"jobs/"+id),

{

title,

company,

image:imageURL,

link,

lastDate,

date:new Date().toLocaleString()

}

);

alert("Job Published");

document.getElementById("jobsForm").reset();

}catch(err){

alert(err.message);

}

publishJob.disabled = false;

publishJob.innerHTML = "Publish Job";

};


// ==========================
// Load Jobs
// ==========================

onValue(ref(db,"jobs"),snapshot=>{

jobsList.innerHTML="";

if(!snapshot.exists()){

jobsList.innerHTML=`

<tr>

<td colspan="6" class="text-center">

No Jobs Found

</td>

</tr>

`;

return;

}

snapshot.forEach(item=>{

const key=item.key;

const data=item.val();

jobsList.innerHTML += `

<tr>

<td>

${data.image ?

`<img src="${data.image}" width="60">`

:

"-"

}

</td>

<td>${data.title}</td>

<td>${data.company}</td>

<td>${data.lastDate || "-"}</td>

<td>

<a
href="${data.link}"
target="_blank"
class="btn btn-success btn-sm">

View

</a>

</td>

<td>

<button
class="btn btn-danger btn-sm"
onclick="deleteJob('${key}')">

Delete

</button>

</td>

</tr>

`;

});

});


// ==========================
// Delete Job
// ==========================

window.deleteJob = async(id)=>{

if(!confirm("Delete this Job?")) return;

try{

await remove(ref(db,"jobs/"+id));

alert("Deleted");

}catch(err){

alert(err.message);

}

};


// ==========================
// Dashboard Job Count
// ==========================

onValue(ref(db,"jobs"),snapshot=>{

document.getElementById("jobsCount").innerHTML=

snapshot.exists()

?

snapshot.size ||

Object.keys(snapshot.val()).length

:

0;

});

// =====================================
// Part 10-5
// BTEUP Publish + Load + Delete
// =====================================

const publishBteup = document.getElementById("publishBteup");
const bteupList = document.getElementById("bteupList");

// ==========================
// Publish BTEUP
// ==========================

publishBteup.onclick = async () => {

const title = document.getElementById("bteupTitle").value.trim();

const link = document.getElementById("bteupLink").value.trim();

if (!title || !link) {

alert("Please fill all fields");

return;

}

publishBteup.disabled = true;

publishBteup.innerHTML = "Publishing...";

try {

const id = Date.now().toString();

await set(

ref(db, "bteup/" + id),

{

title,

link,

date: new Date().toLocaleString()

}

);

alert("BTEUP Update Published");

document.getElementById("bteupForm").reset();

} catch (err) {

alert(err.message);

}

publishBteup.disabled = false;

publishBteup.innerHTML = "Publish";

};


// ==========================
// Load BTEUP
// ==========================

onValue(ref(db, "bteup"), (snapshot) => {

bteupList.innerHTML = "";

if (!snapshot.exists()) {

bteupList.innerHTML = `

<tr>

<td colspan="3" class="text-center">

No BTEUP Updates Found

</td>

</tr>

`;

return;

}

snapshot.forEach((item) => {

const key = item.key;

const data = item.val();

bteupList.innerHTML += `

<tr>

<td>${data.title}</td>

<td>

<a href="${data.link}"

target="_blank"

class="btn btn-success btn-sm">

View

</a>

</td>

<td>

<button

class="btn btn-danger btn-sm"

onclick="deleteBteup('${key}')">

Delete

</button>

</td>

</tr>

`;

});

});


// ==========================
// Delete BTEUP
// ==========================

window.deleteBteup = async function(id){

if(!confirm("Delete this update?")) return;

try{

await remove(ref(db,"bteup/"+id));

alert("Deleted Successfully");

}catch(err){

alert(err.message);

}

};


// ==========================
// Dashboard Count
// ==========================

onValue(ref(db,"bteup"),(snapshot)=>{

document.getElementById("bteupCount").innerHTML=

snapshot.exists()

?

snapshot.size ||

Object.keys(snapshot.val()).length

:

0;

}); 


// =====================================
// Part 10-6
// PYQ Publish + Load + Delete
// =====================================

const publishPyq = document.getElementById("publishPyq");
const pyqList = document.getElementById("pyqList");

// ==========================
// Publish PYQ
// ==========================

publishPyq.onclick = async () => {

const title = document.getElementById("pyqTitle").value.trim();

const link = document.getElementById("pyqLink").value.trim();

if (!title || !link) {

alert("Please fill all fields");

return;

}

publishPyq.disabled = true;

publishPyq.innerHTML = "Publishing...";

try {

const id = Date.now().toString();

await set(

ref(db, "pyq/" + id),

{

title,

link,

date: new Date().toLocaleString()

}

);

alert("PYQ Published");

document.getElementById("pyqForm").reset();

} catch (err) {

alert(err.message);

}

publishPyq.disabled = false;

publishPyq.innerHTML = "Publish";

};


// ==========================
// Load PYQ
// ==========================

onValue(ref(db, "pyq"), (snapshot) => {

pyqList.innerHTML = "";

if (!snapshot.exists()) {

pyqList.innerHTML = `

<tr>

<td colspan="3" class="text-center">

No PYQ Found

</td>

</tr>

`;

return;

}

snapshot.forEach((item) => {

const key = item.key;

const data = item.val();

pyqList.innerHTML += `

<tr>

<td>${data.title}</td>

<td>

<a
href="${data.link}"
target="_blank"
class="btn btn-success btn-sm">

View

</a>

</td>

<td>

<button
class="btn btn-danger btn-sm"
onclick="deletePyq('${key}')">

Delete

</button>

</td>

</tr>

`;

});

});


// ==========================
// Delete PYQ
// ==========================

window.deletePyq = async function(id){

if(!confirm("Delete this PYQ?")) return;

try{

await remove(ref(db,"pyq/"+id));

alert("Deleted Successfully");

}catch(err){

alert(err.message);

}

};


// ==========================
// Dashboard Count
// ==========================

onValue(ref(db,"pyq"),(snapshot)=>{

const count = snapshot.exists()

? (snapshot.size || Object.keys(snapshot.val()).length)

: 0;

// अगर HTML में pyqCount है तभी Update करें
const pyqCount = document.getElementById("pyqCount");

if(pyqCount){

pyqCount.innerHTML = count;

}

});

// =====================================
// Part 10-7
// WhatsApp Group Publish + Load + Delete
// =====================================

const publishWhatsapp = document.getElementById("publishWhatsapp");
const whatsappList = document.getElementById("whatsappList");

// ==========================
// Publish WhatsApp Group
// ==========================

publishWhatsapp.onclick = async () => {

const groupName = document.getElementById("groupName").value.trim();

const groupLink = document.getElementById("groupLink").value.trim();

if (!groupName || !groupLink) {

alert("Please fill all fields");

return;

}

publishWhatsapp.disabled = true;

publishWhatsapp.innerHTML = "Publishing...";

try {

const id = Date.now().toString();

await set(

ref(db, "whatsapp/" + id),

{

groupName,

groupLink,

date: new Date().toLocaleString()

}

);

alert("WhatsApp Group Published");

document.getElementById("whatsappForm").reset();

} catch (err) {

alert(err.message);

}

publishWhatsapp.disabled = false;

publishWhatsapp.innerHTML = "Publish Group";

};


// ==========================
// Load WhatsApp Groups
// ==========================

onValue(ref(db, "whatsapp"), (snapshot) => {

whatsappList.innerHTML = "";

if (!snapshot.exists()) {

whatsappList.innerHTML = `

<tr>

<td colspan="3" class="text-center">

No WhatsApp Groups Found

</td>

</tr>

`;

return;

}

snapshot.forEach((item) => {

const key = item.key;

const data = item.val();

whatsappList.innerHTML += `

<tr>

<td>${data.groupName}</td>

<td>

<a
href="${data.groupLink}"
target="_blank"
class="btn btn-success btn-sm">

Join Group

</a>

</td>

<td>

<button
class="btn btn-danger btn-sm"
onclick="deleteWhatsapp('${key}')">

Delete

</button>

</td>

</tr>

`;

});

});


// ==========================
// Delete WhatsApp Group
// ==========================

window.deleteWhatsapp = async function(id){

if(!confirm("Delete this WhatsApp Group?")) return;

try{

await remove(ref(db,"whatsapp/"+id));

alert("Deleted Successfully");

}catch(err){

alert(err.message);

}

};


// ==========================
// Dashboard Count
// ==========================

onValue(ref(db,"whatsapp"),(snapshot)=>{

const count = snapshot.exists()

? (snapshot.size || Object.keys(snapshot.val()).length)

: 0;

const whatsappCount = document.getElementById("whatsappCount");

if(whatsappCount){

whatsappCount.innerHTML = count;

}

});

// =====================================
// Part 10-8
// Dashboard + Utilities + Recent Activity
// =====================================


// ==========================
// Recent Activity
// ==========================

function addActivity(message){

const activity=document.getElementById("recentActivity");

if(!activity) return;

const time=new Date().toLocaleString();

activity.innerHTML=`

<div class="border-bottom py-2">

<strong>${message}</strong>

<br>

<small class="text-muted">${time}</small>

</div>

`+activity.innerHTML;

}


// ==========================
// Dashboard Counts
// ==========================

function updateDashboard(){

onValue(ref(db,"semester"),snap=>{

const c=snap.exists()

?(snap.size||Object.keys(snap.val()).length)

:0;

document.getElementById("semesterCount").innerHTML=c;

});



onValue(ref(db,"jobs"),snap=>{

const c=snap.exists()

?(snap.size||Object.keys(snap.val()).length)

:0;

document.getElementById("jobsCount").innerHTML=c;

});



onValue(ref(db,"bteup"),snap=>{

const c=snap.exists()

?(snap.size||Object.keys(snap.val()).length)

:0;

document.getElementById("bteupCount").innerHTML=c;

});



onValue(ref(db,"whatsapp"),snap=>{

const c=snap.exists()

?(snap.size||Object.keys(snap.val()).length)

:0;

document.getElementById("whatsappCount").innerHTML=c;

});

}

updateDashboard();


// ==========================
// Helpers
// ==========================

function showSuccess(msg){

alert(msg);

}

function showError(msg){

alert(msg);

}


// ==========================
// Publish Activity
// ==========================

document.addEventListener("click",(e)=>{

if(e.target.id==="publishSemester"){

addActivity("New Semester File Published");

}

if(e.target.id==="publishJob"){

addActivity("New Job Published");

}

if(e.target.id==="publishBteup"){

addActivity("New BTEUP Update Published");

}

if(e.target.id==="publishPyq"){

addActivity("New PYQ Published");

}

if(e.target.id==="publishWhatsapp"){

addActivity("New WhatsApp Group Published");

}

});


// ==========================
// Logout Activity
// ==========================

if(logoutBtn){

logoutBtn.addEventListener("click",()=>{

console.log("Logged Out");

});

}

if(logoutBtn2){

logoutBtn2.addEventListener("click",()=>{

console.log("Logged Out");

});

}


// ==========================
// Admin Panel Loaded
// ==========================

window.addEventListener("load",()=>{

console.log("Diploma Engineers Admin Loaded");

});


// =====================================
// End of app.js
// =====================================   
