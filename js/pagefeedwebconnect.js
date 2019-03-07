var APP_ID = '414066029421126'; //Facebook APP ID
var LIMIT = 100; //Number of records to bring back at any time
var BASEURL = 'https://nhungbcaaa.github.io/' //base url of virtual directory

window.fbAsyncInit = function() {
  FB.init({
    appId: APP_ID, // Tableau Facebook APP ID
    channelUrl: BASEURL + 'channel.html', // Channel File
    status: true, // check login status
    cookie: true, // enable cookies to allow the server to access the session
    xfbml: true // parse XFBML
  });

  //FB.Event.subscribe('auth.statusChange', function(response) {
  FB.getLoginStatus(function(response) {
    if (response.status === 'connected') {
      //document.getElementById("message").innerHTML += "<br>Connected to Facebook";
      //SUCCESS
      //getUserInfo(); //if connected to Facebook then show user's information
      var str = "<input class='btn btn-dark btn-lg' type='button' value='Get Account Info' onclick='getUserInfo();'/><p></p>";
      document.getElementById("status").innerHTML = str;
    } else if (response.status === 'not_authorized') {
      document.getElementById("message").innerHTML += "<br>Failed to Connect";
      //FAILED
    } else {
      document.getElementById("message").innerHTML += "<br>Logged Out";
      //UNKNOWN ERROR
    }
  });
};

//Facbook Login on Single Page as Tableau does not allow popups
function Login() {
  var uri = window.location.href;
  window.top.location = encodeURI("https://www.facebook.com/dialog/oauth?client_id=" + APP_ID + "&redirect_uri=" + uri + "&response_type=token&scope=manage_pages,read_insights,user_friends,user_status,user_photos,user_videos,user_likes,user_hometown,user_birthday,email");
  //window.top.location = encodeURI("https://www.facebook.com/dialog/oauth?client_id=" + APP_ID + "&redirect_uri="+ uri + "&response_type=token&scope=manage_pages");
}

function getUserInfo() {
  FB.api('/me', function(response) {
    var str = "<b>Welcome</b> : " + response.name + "<br>";
    /*str +="<b>Link: </b>"+response.link+"<br>";
    str +="<b>id: </b>"+response.id+"<br>";
    str +="<b>Email:</b> "+response.email+"<br>";*/
    //str +="<input class='btn btn-dark btn-lg' type='button' value='Logout' onclick='Logout();'/><p></p>";
    str += "<input class='btn btn-dark btn-lg' type='button' value='Select All'  onclick='toggle();'/><p></p>";
    document.getElementById("status").innerHTML = str;

    getAccounts(); //get user's accounts i.e. pages that they are authorised for

    //console.log('/me');
    //console.log(response);
  });
}

//selects all checkboxes
function toggle() {
  checkboxes = document.getElementsByName('check');
  for (var i = 0, n = checkboxes.length; i < n; i++) {
    checkboxes[i].checked = true;
  }
}

//get user's account information
function getAccounts() {
  FB.api('/me/accounts?fields=name,access_token,id,picture', function(response) {

    if (response.data.length == 0) {
      var str = "You must be assigned a Page Role for at least one Facebook Page to use this connector" + " " + "</br></br>";
      document.getElementById("status").innerHTML += str;
      return;
    }

    for (i = 0; i < response.data.length; i++) {
      var page_id = response.data[i].id;
      var PageImageUrl = response.data[i].picture.data.url;

      //var checkbox = "<input type='checkbox' name='check' size value='" + page_id + "'style='width:20px;height:20px;\'>" + "      ";
      var checkbox = "<input type='checkbox' name='check' size value='" + page_id + "'>";
      document.getElementById("status").innerHTML += checkbox;

      var strPicture = "<img src=\"" + PageImageUrl + "\"alt=\"Failed To Retrieve FaceBook Image\">";
      document.getElementById("status").innerHTML += strPicture;

      var str = " " + response.data[i].name + " " + "</br></br>";
      document.getElementById("status").innerHTML += str;
    }

    var str = "<input class='btn btn-dark btn-lg' type='button' value='Get Page Feed' onclick='getData(\"" + response.data[0].access_token + "\",\"" + response.data[0].id + "\");'/></br></br>";
    document.getElementById("status").innerHTML += str;
  });
}

//gets top level data about page
function getData(access_token, page_id) {

  //get page ids for selected pages
  var page_ids = [];
  var checkboxes = document.getElementsByName('check');
  for (var i = 0, n = checkboxes.length; i < n; i++) {
    if (checkboxes[i].checked)
      page_ids.push(checkboxes[i].value)
  }
  if (page_ids.length == 0) //if no pages have been selected do nothing
  {
    return;
  }

  var strPage = '/?ids=' + page_ids.join(',') + "&fields=country_page_likes,talking_about_count,new_like_count,link,name"; //get page information for all selected pages
  FB.api(strPage, function(page_response) {

    //pageInfo contains page information and access token to access page data
    var pageInfo = {
      'token': access_token,
      'page_response': page_response
    };

    tableau.connectionData = JSON.stringify(pageInfo); // set pageInfo as the connection data so we can get to it when we fetch the data
    tableau.connectionName = 'Facebook Page Feed'; // name the data source. This will be the data source name in Tableau
    tableau.submit();
  });
}


function Logout() {
  FB.logout(function() {
    document.location.reload();
  });
}

(function() {

  //Helper function. Returns property if it exists in data object.
  function ifexists(data, property) {
    var str = property.split('.')[0]; //get top level object

    if (data.hasOwnProperty(str)) {
      var strToRet = data[property.split('.')[0]][property.split('.')[1]]; //return second level object
      return strToRet;
    } else {
      return '';
    }
  }

  //Helper function. Builds url for initail search string for each page.
  function buildUrl(pageCount, page_response) {
    var page_ids = Object.getOwnPropertyNames(page_response);
    var next_page = '/' + page_response[page_ids[pageCount - 1]].id + '/feed?fields=likes.limit(1).summary(true), comments.limit(1).summary(true).filter(toplevel), message, caption, created_time, description, icon, id, is_expired, is_hidden, link, name, picture, source, status_type, subscribed, type, updated_time, application, from, shares';

    return next_page;
  }

  function getDataForPage(table, doneCallback, connectionUri, pageInfo, pageCount) {
    //get page feed data
    FB.api(connectionUri, {
      access_token: pageInfo.token,
      date_format: 'U', //set time format to unicode so that it works with Tableau
      limit: LIMIT
    }, function(feed_response) {
      var page_response = pageInfo.page_response;
      //if no data then we have finished so move onto next select page or return empty list to Tableau
      if (feed_response.data.length == 0) {
        var keys = Object.keys(page_response);

        //if this is tha last page then we are finished. Else setup next page.
        if (pageCount == keys.length) {
          doneCallback()
        } else {
          //build string for initial search for next page
          var page_ids = Object.getOwnPropertyNames(page_response);
          var newPageCount = pageCount + 1;
          var newPageUri = buildUrl(newPageCount, page_response);

          getDataForPage(table, doneCallback, newPageUri, pageInfo, newPageCount)
        }
      } else {
        var data = feed_response.data;
        var tableData = [];

        // for each post mash the data into an array of objects
        for (ii = 0; ii < data.length; ++ii) {
          //get total comment count
          var totalComments;
          if (data[ii].comments) {
            totalComments = data[ii].comments.summary.total_count;
          }

          //get total like count
          var totalLikes;
          if (data[ii].likes) {
            totalLikes = data[ii].likes.summary.total_count;
          }

          //get created_time
          var created_time;
          if (data[ii].created_time) {
            created_time = new Date(data[ii].created_time * 1000);
          } else {
            created_time = new Date(0);
          }

          //get updated_time
          var updated_time;
          if (data[ii].updated_time) {
            updated_time = new Date(data[ii].updated_time * 1000);
          } else {
            updated_time = new Date(0);
          }

          var page_ids = Object.getOwnPropertyNames(page_response);
          var currentPage = page_response[page_ids[pageCount - 1]];

          var entry = {
            'page_name': currentPage.name,
            'page_likes': currentPage.country_page_likes,
            'Page New Likes': currentPage.new_like_count,
            'Page Talking About': currentPage.talking_about_count,
            'page_id': currentPage.id,
            'page_link': currentPage.link,
            'message': data[ii].message,
            'caption': data[ii].caption,
          };
          tableData.push(entry);
        };
        table.appendRows(tableData);
        var paging_next = feed_response.paging.next
        getDataForPage(table, doneCallback, paging_next, pageInfo, pageCount)
      }
    })
  }

  var myConnector = tableau.makeConnector();

  myConnector.getSchema = function(schemaCallback) {
    var fieldNames = ['page_name', 'page_likes', 'Page New Likes', 'Page Talking About', 'page_id', 'page_link', 'message', 'caption', 'created_time', 'description', 'icon', 'post_id', 'is_expired', 'is_hidden', 'link', 'name', 'picture', 'source', 'status_type', 'subscribed', 'type', 'updated_time', 'application_name', 'application_id', 'from_id', 'from_name', 'Post Shares', 'Post Likes', 'Post Comments (Top Level)'];

    var fieldTypes = ['string', 'float', 'float', 'float', 'float', 'string', 'string', 'string', 'datetime', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'datetime', 'string', 'float', 'float', 'string', 'float', 'float', 'float'];

    // tableau.headersCallback(fieldNames, fieldTypes); // tell tableau about the fields and their types

    var cols = [{
        id: "page_name",
        alias: "pagename",
        dataType: tableau.dataTypeEnum.string
      },
      {
        id: "page_likes",
        alias: "page likes",
        dataType: tableau.dataTypeEnum.float
      },
      {
        id: "page_new_likes",
        alias: "Page new likes",
        dataType: tableau.dataTypeEnum.float
      },
      {
        id: "page_talking_about",
        alias: "Page Talking About",
        dataType: tableau.dataTypeEnum.float
      },
      {
        id: "page_id",
        alias: "page_id",
        dataType: tableau.dataTypeEnum.float
      },
      {
        id: "page_link",
        alias: "page_link",
        dataType: tableau.dataTypeEnum.string
      },
      {
        id: "message",
        alias: "message",
        dataType: tableau.dataTypeEnum.string
      },
      {
        id: "caption",
        alias: "caption",
        dataType: tableau.dataTypeEnum.string
      }
    ];

    var tableInfo = {
      id: "facebook_page_feed",
      alias: "Facebook page Feed",
      columns: cols
    };

    schemaCallback([tableInfo]);
  };

  myConnector.getData = function(table, doneCallback) {
    var pageInfo = JSON.parse(tableau.connectionData); //includes page response and access token
    var page_response = pageInfo.page_response;
    var next_page = buildUrl(1, page_response);
    getDataForPage(table, doneCallback, next_page, pageInfo, 1)
  };

  tableau.registerConnector(myConnector);
})();
