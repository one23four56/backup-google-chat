// Proprietary Message Class for the Search Page 
// this is compiled from typescript
// this is not compiled automatically, you will have to manually run the compile command
var id = function (element) { return document.getElementById(element); };
var Message = /** @class */ (function () {
    function Message(data) {
        this.draw(data);
        this.data = data;
    }
    Message.prototype.draw = function (data) {
        var msg = document.createElement('div');
        msg.classList.add('message');
        if (data.id)
            msg.setAttribute('data-message-id', data.id.toString());
        msg.setAttribute("data-message-author", data.author.name);
        var holder = document.createElement('div');
        var b = document.createElement('b');
        b.innerText = data.author.name;
        if (data.tag)
            b.innerHTML += " <p style=\"padding:2px;margin:0;font-size:x-small;color:".concat(data.tag.color, ";background-color:").concat(data.tag.bg_color, ";border-radius:5px;\">").concat(data.tag.text, "</p>");
        if (data.isWebhook)
            msg.title = "Sent by " + data.sentBy;
        var p = document.createElement('p');
        p.innerText = "".concat(data.text);
        var prev_conditional = false;
        if (prev_conditional)
            b.style.display = 'none';
        holder.appendChild(b);
        holder.appendChild(p);
        var img = document.createElement('img');
        img.src = data.author.img;
        if (prev_conditional) {
            img.style.height = '0';
            msg.style.marginTop = '0';
        }
        //I have no clue why, but when I made this a p the alignment broke
        var i = document.createElement('i');
        i.innerText = new Date(data.time).toLocaleString();
        var archive;
        if (data.archive === false) {
            archive = document.createElement('i');
            archive.classList.add('fas', 'fa-user-secret', 'fa-fw');
            archive.title = "Message was not saved to the archive";
            this.archive = false;
        }
        else
            this.archive = true;
        msg.appendChild(img);
        msg.appendChild(holder);
        msg.appendChild(i);
        if (archive)
            msg.appendChild(archive);
        this.msg = msg;
    };
    return Message;
}());
