const loginForm = document.getElementById('loginform')
const username = document.getElementById('username-input')
const password = document.getElementById('password-input')
const errordiv = document.getElementById("errordiv")
const logincontainer = document.getElementById("logincontainer")
const logout = document.getElementById("logout")

loginForm.addEventListener("submit", async e => {
        e.preventDefault();
        const usernameVal = username.value
        const passwordVal = password.value
        try {
            fetch("https://01.kood.tech/api/auth/signin", {
                method: "POST",
                headers: {
                    "Authorization": "basic " + btoa(`${usernameVal}:${passwordVal}`)
                }
            })
            .then(async res => {
                if (res.ok) {
                    const token = await res.json()
                    localStorage.setItem("jwt", token)
                    getData()
                } else {
                    const errortext = await res.json()
                    errordiv.innerHTML = errortext.error
                }
            })
        } catch (err) {
            console.error(err)
            displayError("Error! Try again!")
        }
})

function getData() {
    fetch("https://01.kood.tech/api/graphql-engine/v1/graphql", { // make API request 
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("jwt")}`
        },
        body: JSON.stringify({
        query : `
            query {
                user {
                    id
                    login
                    attrs
                    totalUp
                    totalDown
                    createdAt
                    updatedAt
                    transactions(order_by: { createdAt: asc }) {
                        id
                        createdAt	
                        objectId
                        type
                        amount
                        path
                        object{
                            id
                            name
                            type
                            attrs
                          }
                    }
                }
            }
        `
        })
    }).then(response => response.json())
    .then(data => {
        let levelgraph = []
        let transactions = data.data.user[0].transactions // users all transactions
        let up = data.data.user[0].totalUp // done audit value
        let down = data.data.user[0].totalDown // received audit value
        let xp = 0
        let level = 0
        let projects = []
        let audits = []
        transactions.forEach(element => { // loop the API data 
            if (element.type == "xp" && !element.path.includes("piscine")) { // get all done projects excluding piscines
                xp += element.amount
                projects.push(element) // and add them to array
                const date = new Date(element.createdAt)
                const time = date.toLocaleString("default", { month: "short", year: "numeric" }); // format date for progression graph
                if (levelgraph.length == 0) {levelgraph = generateScale(time)} // create new array for progression graph with time and value
                levelgraph.forEach(e => {
                    if (time == e.time) {
                        e.value = xp/1000
                    } 
                })
            }
            if (element.type == "level" && element.path.includes("/johvi/div-01/")) { // get users level
                if (element.amount > level) {
                    level = element.amount
                }
            }
            if (element.type == "up") { // get all users done audits and push them to array
                audits.push(element)
            }
        });
        const app = document.getElementById("app")
        logincontainer.style.display = "none"
        app.style.display = "flex"
        logout.style.display = "block"
        logout.addEventListener("click", function () { //event listener to hide info when mouse is out of target
            localStorage.removeItem("jwt")
            logincontainer.style.display = "flex"
            app.style.display = "none"
            errordiv.style.display = "none";
            logout.style.display = "none"
            username.value = ""
            password.value = ""
        });
        makeAuditData(audits, up, down)
        makeUserData(data.data.user, projects, level)
        makePieSlice(projects, xp)
        makeProgressData(levelgraph)
    })
}

function generateScale(start) { // function to create object element for each month from start date until now and values
    const cur = new Date(`15 ${start}`)
    const untilDateString = new Date(new Date().getFullYear(), new Date().getMonth()+1, 15).toDateString()
    const result = []
    for(; untilDateString !== cur.toDateString(); cur.setMonth(cur.getMonth()+1))
      result.push({time: cur.toLocaleString('default', { month: 'short', year: 'numeric' }), value: 0})
    return result
}

function makeProgressData(projects) { // function to create users monthly xp progression line graph
    for (let i = 0; i < projects.length; i++) { // looping projects to populate element with values, where value is 0 (months you have received 0 xp) so graph looks cleaner
        if (projects[i].value == 0 && i != 0) {
            projects[i].value = projects[i-1].value
            
        } 
    }
    var width = 600
    var height = 250
    var margin = { top: 20, right: 20, bottom: 30, left: 50 }

    var svg = d3.select("#linegraph") // creating svg element, adding dimensions to it and appending it to line graph div
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")")

    var x = d3.scalePoint().range([0, width]).padding(0.1) // setting up x and y axis scales
    var y = d3.scaleLinear().range([height, 0])

    var line = d3.line() // create line 
        .x(function (d) { return x(d.time) })
        .y(function (d) { return y(d.value) })

    x.domain(projects.map(function (d) { return d.time; })); // create domains for x and y axis
    y.domain([0, d3.max(projects, function (d) { return d.value; })])

    svg.append("g") // add x axis to svg element
        .style("font-size", "11px")
        .attr("class", "axis")
        .attr("transform", "translate(0," + height + ")")
        .attr("color", "white")
        .call(d3.axisBottom(x));

    svg.append("g") // add y axis to svg element
        .style("font-size", "11px")
        .attr("class", "axis")
        .attr("color", "white")
        .call(d3.axisLeft(y));
        
    svg.append("text") // add text to y axis
        .text("XP (kB)")
        .style('fill', 'white')
        .attr("x", -30)
        .attr("y", -5);
        
    svg.append("path") // add line path to svg element
        .attr("fill", "none")
        .attr("stroke", "green")
        .attr("stroke-width", 2)
        .datum(projects)
        .attr("class", "line")
        .attr("d", line);
}

function makeAuditData(audits, up, down) { // function to write users audit data to html elements
    for (let i = 1; i < audits.length; i++) { // loop audits and sort them by time
        if (audits[i].createdAt < audits[i-1].createdAt) {
            audits[i], audits[i-1] = audits[i-1], audits[i]
        }
    }
    const auditsdone = document.getElementById("auditsdone")
    auditsdone.innerHTML = (`Done audits XP: ${up/1000} kB`)
    const auditsreceived = document.getElementById("auditsreceived")
    auditsreceived.innerHTML = (`Received audits XP: ${down/1000} kB`)
    const auditsratio = document.getElementById("auditsratio")
    auditsratio.innerHTML = (`Audit ratio: ${(up/down).toFixed(2)}`)
    const auditscount = document.getElementById("auditscount")
    auditscount.innerHTML = (`Done audit count: <div id = auditnumber></div>`)
    const auditnumber = document.getElementById("auditnumber")
    auditnumber.innerHTML = (`${audits.length}`)
    date = new Date(audits[0].createdAt)
    let info2 = document.getElementById("info2")
    auditnumber.addEventListener("mousemove", event => { //event listener to show users done audits with mouse over event
        info2.innerHTML = ""
        info2.style.display = "block"
        var mouseX = event.clientX
        var mouseY = event.clientY
        info2.style.left = mouseX + 20 + "px"
        info2.style.top = mouseY - 30 + "px"
        audits.forEach(element => { // looping audits and adding every element to info div
            date = new Date(element.createdAt)
            var shortdate = date.toLocaleString("en-GB")
            let audit = document.createElement("div")
            audit.setAttribute("class", "audit")
            audit.innerHTML = `${element.object.name} - ${element.amount/1000}kB at ${shortdate}`
            info2.append(audit)
        })
    })
    auditnumber.addEventListener("mouseout", function () { //event listener to hide info when mouse is out of target
        info2.style.display = "none"
    });
}

function makeUserData(data, projects, lvl) { // function to create users basic information elements
    const userdiv = document.getElementById("userinfo")
    const username = document.getElementById("username")
    username.innerHTML = (`Username: ${data[0].login}`)
    const email = document.getElementById("email")
    email.innerHTML = (`Email: ${data[0].attrs.email}`)
    const name = document.getElementById("name")
    name.innerHTML = (`Name: ${data[0].attrs.firstName} ${data[0].attrs.lastName}`)
    const telephone = document.getElementById("telephone")
    telephone.innerHTML = (`Telephone: ${data[0].attrs.tel}`)
    const country = document.getElementById("country")
    country.innerHTML = (`Country: ${data[0].attrs.country}`)
    const lastproject = document.getElementById("lastproject")
    lastproject.innerHTML = (`Last project: ${projects[projects.length-1].object.name}`)
    const level = document.getElementById("level")
    level.innerHTML = (`Level: ${lvl}`)
}

function makePieSlice(projects, xp) { // function to create pie chart for total projects
    const colors = ["#0074D9", "#FF4136", "#2ECC40", "#FF851B", "#7FDBFF", "#B10DC9", "#FFDC00", "#555f3f", "#39CCCC", "#01FF70", "#85144b", "#F012BE", "#3D9970", "#111111", "#AAAAAA"]
    const circumfence = 2*Math.PI*75
    let start = -90
    let colorcount = 0
    const pie = document.getElementById("xp")
    projects.forEach( element => { //creating pie slice for each done project
        let slicesize = element.amount/xp*360 // calculating, how many degrees current project takes in pie (circle), so I can rotate next element slice for correct amount
        let sliceradius = element.amount/xp*100*circumfence/100 // calculating slice radius
        let info = document.getElementById("info")
        var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle") // creating element for pie slice and applying attributes
        circle.setAttribute("class", "circle")
        circle.setAttribute("r", 75)
        circle.setAttribute("cx", 150)
        circle.setAttribute("cy", 150)
        circle.setAttribute("fill", "transparent")
        circle.setAttribute("stroke", colors[colorcount])
        circle.setAttribute("stroke-width", 150)
        circle.setAttribute("stroke-dasharray", `${sliceradius} ${2*Math.PI*75}`)
        circle.setAttribute("transform", `rotate(${start} 150 150)`)
        pie.append(circle)
        const pietext = document.getElementById("pietext");
        pietext.innerHTML = `TOTAL: ${projects.length} PROJECTS (${xp/1000} XP)` 
        circle.addEventListener("mousemove", event => { //event listener to show pie slice information on mouse over event
            info.style.display = "block"
            var mouseX = event.clientX
            var mouseY = event.clientY
            info.style.left = mouseX + window.scrollX + 10 + "px"
            info.style.top = mouseY + window.scrollY -30 +  "px"
            info.innerHTML = `${element.object.name} - ${element.amount/1000}XP (${(element.amount/xp*100).toFixed(2)}%)`
        })
        circle.addEventListener("mouseout", function () { //event listener to hide info when mouse is out of target
            info.style.display = "none"
        });
        start += slicesize
        colorcount == colors.length ? colorcount = 0 : colorcount++
    })
    var circle2 = document.createElementNS("http://www.w3.org/2000/svg", "circle") //creating inner circle for pie chart
    circle2.setAttribute("r", 75)
    circle2.setAttribute("cx", 150)
    circle2.setAttribute("cy", 150)
    circle2.setAttribute("fill", "#202125")
    pie.append(circle2)

    circle2.addEventListener("mouseover", () => { //event listener to hide info when mouse is out of target
        info.style.display = "none"
    })
} 