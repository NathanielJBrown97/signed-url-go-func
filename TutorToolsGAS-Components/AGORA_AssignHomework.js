// AGORA version of Assign Homework

var agoraDescriptionPrefix = "Please print the attached PDF and follow the instructions below:\n\n";

var agoraTimingVideos = {
  "SAT_reading": ["https://www.youtube.com/watch?v=pf2lP0frTow","https://www.youtube.com/watch?v=p58GH3rLFFg"],
  "SAT_writing": ["https://www.youtube.com/watch?v=KI31qLrqXcE","https://www.youtube.com/watch?v=KmEzYAOev8k"],
  "SAT_nocalc": ["https://www.youtube.com/watch?v=dEuQUCnCAa8","https://www.youtube.com/watch?v=bA4GRON0BuM"],
  "SAT_calc": ["https://www.youtube.com/watch?v=8ezk5_nLAG0","https://www.youtube.com/watch?v=fTm5yvvAZsU"],
  "SAT_math": ["https://www.youtube.com/watch?v=dEuQUCnCAa8","https://www.youtube.com/watch?v=bA4GRON0BuM","https://www.youtube.com/watch?v=8ezk5_nLAG0","https://www.youtube.com/watch?v=fTm5yvvAZsU"],
  "ACT_english": ["https://www.youtube.com/watch?v=9t_TzGVFm_I","https://www.youtube.com/watch?v=U49PTXq0V44"],
  "ACT_math": ["https://www.youtube.com/watch?v=VzxPct_dxzo","https://www.youtube.com/watch?v=E4PBVfCxOBM"],
  "ACT_reading": ["https://www.youtube.com/watch?v=a2SoPgI25_Q","https://www.youtube.com/watch?v=Q9D-ffsK2Gw"],
  "ACT_science": ["https://www.youtube.com/watch?v=H1te6UcDjqE","https://www.youtube.com/watch?v=AB2PYLtwXWY"]
};

/**
 * Opens the AGORA Assign Homework sidebar
 */
function showAGORAAssignSidebar() {
  var html = HtmlService
    .createHtmlOutputFromFile('AGORA_AssignHomeworkUI')
    .setTitle('AGORA Assign Homework');
  SpreadsheetApp.getUi().showSidebar(html);
}
/**
 * Creates a homework assignment in Classroom, using your signed-URL endpoint for the PDF.
 */
function createAGORAHW(testType, options) {
  var descriptionText = options.form.toLowerCase() + '_' + options.section.toLowerCase() + "\n\n"+ agoraDescriptionPrefix;
  var section     = options.section.toLowerCase();;
  var formId      = options.form.toLowerCase();;
  var work        = options.work;
  var dateStr     = options.date;
  var timed       = options.timed;
  var notes       = options.notes;
  var forWhom     = options.forWhom;

  // get class & folder info
  var dataSheet   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('data');
  var classId     = dataSheet.getRange('A1').getValue();
  var studentFolderId = dataSheet.getRange('A3').getValue();
  var dueDate     = parseAGORADate(dateStr);

  // build description
  if (timed) {
    if (testType === 'DSAT') {
      descriptionText += "This assignment should be timed. For math, give yourself 43 minutes for the whole thing and for reading give yourself 39 minutes. If you qualify for extended time, please use 65 minutes for the math section and 59 minutes for reading. Otherwise, please use standard time. If you're not sure, please contact us and we'll help you sort it out!\n\n";
    } else {
      descriptionText += "This assignment should be timed. Please use the attached YouTube proctor. If you qualify for extended time, please use extended time option. Otherwise, please use standard time. If you're not sure, please contact us and we'll help you sort it out!\n\n";
    }
  }
  if (notes) {
    descriptionText += "Use your notes! Circle/mark any problems that you aren't 100% sure about. Do what you can to get as many questions right!\n\n";
  }
  if (testType === 'DSAT') {
    descriptionText += 'Complete problem(s) ';
  } else if (section === 'reading' || section === 'science') {
    descriptionText += 'Complete passage(s) ';
  } else {
    descriptionText += 'Complete problem(s) ';
  }
  descriptionText += work + ' to the best of your ability.\n\nPlease enter your answers into the Google Form that is also attached when you are done and submit before we meet!';

  // build & move the answer-sheet form
  var hwForm = makeAGORAForm(testType, formId, section, work);
  DriveApp.getFileById(hwForm.getId()).moveTo(DriveApp.getFolderById(studentFolderId));
  hwForm.setRequireLogin(false);

  // title
  var titlePrefix = notes ? 'Open Notebook ' : '';
  var title = titlePrefix +
              capitalizeFirstLetter(section) +
              ' Homework Due ' + dueDate.month + '.' + dueDate.day +
              ' (' + forWhom + ')';

  // get the signed URL from your Cloud Function
  var rawName = formId + '_' + section + '.pdf';
  var pdfName = rawName.toLowerCase();
  var endpoint = 'https://us-central1-lee-tutoring-webapp.cloudfunctions.net/GenerateSignedURL'
  var params   = '?file=' + encodeURIComponent(pdfName);
  var resp     = UrlFetchApp.fetch(endpoint + params, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    throw new Error('Couldn’t fetch signed URL for ' + pdfName + ': ' + resp.getContentText());
  }
  var signedUrl = JSON.parse(resp.getContentText()).url;

  // assemble courseWork payload
  var courseWork = {
    title:       title,
    description: descriptionText,
    materials: [
      { link: { url: signedUrl,     title: pdfName            } },
      { link: { url: hwForm.getPublishedUrl(), title: 'Answer Sheet' } }
    ],
    dueDate:   dueDate,
    dueTime:   { hours:23, minutes:59, seconds:59, nanos:0 },
    maxPoints: 100,
    workType:  'ASSIGNMENT',
    state:     'PUBLISHED'
  };

  // attach timing videos if needed
  if (timed && testType !== 'DSAT') {
    var vids = agoraTimingVideos[testType + '_' + section];
    courseWork.materials.push({ link:{ url:vids[0], title:section + ' Standard Time Proctor' } });
    courseWork.materials.push({ link:{ url:vids[1], title:section + ' Extended Time Proctor' } });
    if (testType === 'SAT' && section === 'math') {
      courseWork.materials.push({ link:{ url:vids[2], title:'Calculator Standard Time Proctor' } });
      courseWork.materials.push({ link:{ url:vids[3], title:'Calculator Extended Time Proctor' } });
    }
  }

  // finally, push it to Classroom
  var response = Classroom.Courses.CourseWork.create(courseWork, classId);
  hwForm.addSectionHeaderItem()
    .setTitle('Ignore this stuff!')
    .setHelpText("1,"+studentFolderId+ "," + SpreadsheetApp.getActiveSpreadsheet().getId());
    //.setHelpText([1,studentFolderId,response.id,SpreadsheetApp.getActiveSpreadsheet().getId(), getAGORAStudentId(classId)].join(','));
  hwForm.setPublished(true);
}

/**
 * Handles PT (Practice Test) actions from the sidebar.
 * payload = { mode: "SAT"|"ACT", date: "YYYY-MM-DD", form?: "25mc1"..."25mc5" }
 */
function createAGORAPT(payload) {
  var mode    = payload.mode;         // "SAT" or "ACT"
  var dateStr = payload.date || "";
  var testKey = payload.form || "";   // e.g. "25mc3" when ACT

  var ss        = SpreadsheetApp.getActiveSpreadsheet();
  var dataSheet = ss.getSheetByName('data');
  if (!dataSheet) throw new Error('Missing "data" sheet');

  var classId = dataSheet.getRange('A1').getValue();
  if (!classId) throw new Error('Missing classId in data!A1');

  var dueDate = dateStr ? parseAGORADate(dateStr) : null;

  // -----------------------------
  // PT-SAT = Announcement only
  // -----------------------------
  if (mode === 'SAT') {
    var text = 'Take your SAT practice test! >:L';
    if (dateStr) {
      text += '\n\nDue: ' + dateStr;
    }

    var announcement = {
      text:  text,
      state: 'PUBLISHED'
    };

    Classroom.Courses.Announcements.create(announcement, classId);
    return;
  }

  // -----------------------------
  // PT-ACT = Special ACT practice assignment
  // -----------------------------
  if (mode !== 'ACT') {
    throw new Error('Unsupported PT mode: ' + mode);
  }

  if (!testKey) {
    throw new Error('Missing ACT practice test selection (25mc1–25mc5).');
  }

  var SIGNER_ENDPOINT = 'https://us-central1-lee-tutoring-webapp.cloudfunctions.net/GenerateSignedURL';
  var PRACTICE_BUCKET = 'practice-act';

  // Helper to get signed URL from the practice-act bucket
  function getPracticeSignedUrl(fileName) {
    var url = SIGNER_ENDPOINT
            + '?bucket=' + encodeURIComponent(PRACTICE_BUCKET)
            + '&file='   + encodeURIComponent(fileName);
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) {
      throw new Error('Couldn’t fetch signed URL for ' + fileName + ': ' + resp.getContentText());
    }
    var obj = JSON.parse(resp.getContentText());
    if (!obj.url) {
      throw new Error('Signed URL response missing "url" for ' + fileName);
    }
    return obj.url;
  }

  // Files in the practice-act bucket
  var testPdfName   = testKey + '.pdf'; // "25mc3.pdf"
  var answerPdfName = 'ACT Answer Sheet 2025.pdf';
  var instrPdfName  = 'ACT Instructions (Please Read Thoroughly!).pdf';

  var testUrl   = getPracticeSignedUrl(testPdfName);
  var answerUrl = getPracticeSignedUrl(answerPdfName);
  var instrUrl  = getPracticeSignedUrl(instrPdfName);

  // Body text with clearly labeled links
  var description =
    'Please read the file named "ACT Instructions" thoroughly and ASAP to find the automatic proctor for this test as well as relevant information. Edward will handle timing for you via that Youtube video. Please let us know if you have any questions!\n\n' +

    'Practice Test:\n' + testUrl + '\n\n' +
    'Instructions:\n' + instrUrl + '\n\n' +
    'Answer Sheet:\n' + answerUrl + '\n\n' +

    'Best of luck!';

  var title = 'ACT Practice Test';

  // Attach the same 3 PDFs as Classroom materials
  var materials = [
    { link: { url: instrUrl,  title: instrPdfName } },
    { link: { url: answerUrl, title: answerPdfName } },
    { link: { url: testUrl,   title: testPdfName } }
  ];

  var courseWork = {
    title:       title,
    description: description,
    materials:   materials,
    dueDate:     dueDate || undefined,
    dueTime:     dueDate ? { hours:23, minutes:59, seconds:59, nanos:0 } : undefined,
    maxPoints:   0,              // practice, no points
    workType:    'ASSIGNMENT',
    state:       'PUBLISHED'
  };

  var cw = Classroom.Courses.CourseWork.create(courseWork, classId);

  Logger.log('Created PT-ACT coursework id=%s with files: %s, %s, %s',
             cw.id, instrPdfName, answerPdfName, testPdfName);
}




/**
 * Builds the Google Form for AGORA homework
 */
function makeAGORAForm(testType, formId, subject, problems) {
  var file = DriveApp.getFileById('1h5n6X2uAQSReIjXXlCA6AvvpFKPzUkwz2kSp_wYOe-M').makeCopy();
  var form = FormApp.openById(file.getId());
  form.setTitle('Homework Answer Sheet');
  form.setDescription(testType + '.' + formId + '.' + subject);

  // replicate original grid/text logic:
  if (subject === 'reading' && testType === 'SAT') {
    form.addGridItem()
        .setTitle('Answers for SAT Reading')
        .setHelpText('Only do passage(s) ' + problems + ' as instructed. You may leave some blank.')
        .setRows(getAGORANumList('1-52'))
        .setColumns(['A','B','C','D']);
  }
  else if (subject === 'science') {
    form.addGridItem()
        .setTitle('Answers for ACT Science')
        .setHelpText('Only do passage(s) ' + problems + ' as instructed.')
        .setRows(getAGORANumList('1-40'))
        .setColumns(['A(F)','B(G)','C(H)','D(J)']);
  }
  else if (testType === 'ACT' && subject === 'math') {
    form.addGridItem()
        .setTitle('Answers for ACT Math')
        .setHelpText('Only do problems ' + problems + ' as instructed.')
        .setRows(getAGORANumList('1-60'))
        .setColumns(['A(F)','B(G)','C(H)','D(J)','E(K)']);
  }
  else if (testType === 'ACT' && subject === 'reading') {
    form.addGridItem()
        .setTitle('Answers for ACT Reading')
        .setHelpText('Only do passage(s) ' + problems + ' as instructed.')
        .setRows(getAGORANumList('1-40'))
        .setColumns(['A(F)','B(G)','C(H)','D(J)']);
  }
  else if (testType === 'ACT' && subject === 'english') {
    form.addGridItem()
        .setTitle('Answers for ACT English')
        .setHelpText('Only do problems ' + problems + ' as instructed.')
        .setRows(getAGORANumList('1-75'))
        .setColumns(['A(F)','B(G)','C(H)','D(J)']);
  }
  else if (testType === 'SAT' && subject === 'writing') {
    form.addGridItem()
        .setTitle('Answers for SAT Writing/Language')
        .setHelpText('Only do problems ' + problems + ' as instructed.')
        .setRows(getAGORANumList('1-44'))
        .setColumns(['A','B','C','D']);
  }
  else if (testType === 'SAT' && subject === 'nocalc') {
    form.addGridItem()
        .setTitle('Answers for SAT No Calculator')
        .setHelpText('Only do problems ' + problems + ' as instructed.')
        .setRows(getAGORANumList('1-15'))
        .setColumns(['A','B','C','D']);
    for (var i=0; i<5; i++) {
      form.addTextItem().setTitle('Grid In #' + (16+i));
    }
  }
  else if (testType === 'SAT' && subject === 'calc') {
    form.addGridItem()
        .setTitle('Answers for SAT Calculator')
        .setHelpText('Only do problems ' + problems + ' as instructed.')
        .setRows(getAGORANumList('1-30'))
        .setColumns(['A','B','C','D']);
    for (var j=0; j<8; j++) {
      form.addTextItem().setTitle('Grid In #' + (31+j));
    }
  }
  else if (testType === 'SAT' && subject === 'math') {
    // both sections
    form.addGridItem()
        .setTitle('Answers for SAT No Calculator')
        .setHelpText('Only do problems ' + problems + ' as instructed.')
        .setRows(getAGORANumList('1-15'))
        .setColumns(['A','B','C','D']);
    for (var k=0; k<5; k++) {
      form.addTextItem().setTitle('Grid In #' + (16+k));
    }
    form.addGridItem()
        .setTitle('Answers for SAT Calculator')
        .setHelpText('Only do problems ' + problems + ' as instructed.')
        .setRows(getAGORANumList('1-30'))
        .setColumns(['A','B','C','D']);
    for (var m=0; m<8; m++) {
      form.addTextItem().setTitle('Grid In #' + (31+m));
    }
  }
  else if (testType === 'DSAT') {
    if (subject.startsWith('reading')) {
      form.addGridItem()
          .setTitle('Answers for DSAT Reading')
          .setHelpText('Only do problems ' + problems + ' as instructed.')
          .setRows(getAGORANumList('1-33'))
          .setColumns(['A','B','C','D']);
    } else {
      // split up into grid and grid-in items exactly as original...
      form.addGridItem().setRows(getAGORANumList('1-5')).setColumns(['A','B','C','D']);
      ['6','7'].forEach(n=> form.addTextItem().setTitle('Grid In #' + n));
      form.addGridItem().setRows(getAGORANumList('8-12')).setColumns(['A','B','C','D']);
      ['13','14'].forEach(n=> form.addTextItem().setTitle('Grid In #' + n));
      form.addGridItem().setRows(getAGORANumList('15-19')).setColumns(['A','B','C','D']);
      ['20','21'].forEach(n=> form.addTextItem().setTitle('Grid In #' + n));
      form.addGridItem().setRows(getAGORANumList('22-26')).setColumns(['A','B','C','D']);
      form.addTextItem().setTitle('Grid In #27');
    }
  }

  //The below code handles homework submission automation for students.

  var formId = form.getId();

  var triggerFunction = 'handleAGORAFormSubmit';

  ScriptApp.newTrigger(triggerFunction)
  .forForm(formId)
  .onFormSubmit()
  .create();

  return form;
}

/**
 * Handles form submissions to auto-turn in via Classroom
 */
function handleAGORAFormSubmit(e) {
    var text = e.source.getItems()[e.source.getItems().length-1].getHelpText();
    var checker = text.substring(0,text.indexOf(","));
    Logger.log(text);
    if(checker!=1){
      Logger.log("Not a candidate for auto submission; abandoning submission process.");
      Logger.log(checker);
      return;
    }
    Logger.log("Candidate for Auto Form Submit! Processing now...")
    text = text.substring(text.indexOf(",")+1);
    var retrievedFolderId = text.substring(0,text.indexOf(","));
    text = text.substring(text.indexOf(",")+1);
    var retrievedSpreadsheetID = text;

    Logger.log(retrievedFolderId);
    Logger.log(retrievedSpreadsheetID);
  
    var retSheet = SpreadsheetApp.openById(retrievedSpreadsheetID);
    var name = retSheet.getSheetByName("data").getRange("A2").getValue();
    Logger.log(name);


    // first parameter is form id, second is student sheet, third indicates that this is an auto-submission
    loadHomeworkAnswers2(e.source.getId(),retrievedSpreadsheetID,2);

  
}

/**
 * Returns the first student ID in the class
 */
function getAGORAStudentId(classId) {
  var resp = Classroom.Courses.Students.list(classId);
  return resp.students[0].userId;
}

/**
 * Parses a YYYY-MM-DD string into {year, month, day}
 */
function parseAGORADate(d) {
  return { year: +d.slice(0,4), month: +d.slice(5,7), day: +d.slice(8) };
}

/**
 * Generates an array of strings from "start-end"
 */
function getAGORANumList(range) {
  var dash = range.indexOf('-');
  if (dash < 0) return [];
  var start = +range.slice(0, dash), end = +range.slice(dash + 1);
  var arr = [];
  for (var i = start; i <= end; i++) arr.push(String(i));
  return arr;
}

/**
 * Capitalizes the first letter of a string
 */
function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
