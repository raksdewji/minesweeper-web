"use strict";

/**
 * Main code provided by Pavol Federl, some code used from Emmanuel for the timer and
 * grid code.
 */
let MSGame = (function () {
  // private constants
  const board = document.querySelector(".game-board");
  const STATE_HIDDEN = "hidden";
  const STATE_SHOWN = "shown";
  const STATE_MARKED = "marked";

  function array2d(nrows, ncols, val) {
    const res = [];
    for (let row = 0; row < nrows; row++) {
      const gridRow = document.createElement("div");
      gridRow.setAttribute("id", `${row}`);

      if (gridSize === 'easy') {
        gridRow.classList.add("row-easy");
      } else {
        gridRow.classList.add("row-med")
      }

      res[row] = [];
      for (let col = 0; col < ncols; col++) {
        res[row][col] = val(row, col);

        const piece = document.createElement("div");
        piece.setAttribute("id", `${row} ${col}`);

        if (gridSize === 'easy') {
          piece.classList.add("col-easy");
        } else {
          piece.classList.add("col-med")
        }

        $(piece).on("taphold", tapHander).on("click", clickHandler);

        gridRow.appendChild(piece);
      }
      board.appendChild(gridRow);
    }
    return res;
  }

  // returns random integer in range [min, max]
  function rndInt(min, max) {
    [min, max] = [Math.ceil(min), Math.floor(max)];
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function tapHander(input) {
    const arr = input.target.id.split(" ");
    console.log(arr);
    let row = parseInt(arr[0]);
    let col = parseInt(arr[1]);
    game.mark(row, col);
    game.drawBoard(game.getRendering());
    updateGame(game.getStatus());
  }

  function clickHandler(input) {
    const arr = input.target.id.split(" ");
    let row = parseInt(arr[0]);
    let col = parseInt(arr[1]);
    game.uncover(row, col);
    game.drawBoard(game.getRendering());
    updateGame(game.getStatus());
  }

  function updateGame(status) {
    console.log(status);
    if (status.exploded === true) {
      clearTimeout(t);
      game.endGame(game.getRendering());
    }
    else if (status.done) {
      clearTimeout(t);
      game.wonGame();
    }
  }

  class _MSGame {
    constructor() {}

    validCoord(row, col) {
      return row >= 0 && row < this.nrows && col >= 0 && col < this.ncols;
    }

    init(nrows, ncols, nmines) {
      console.log(board);
      this.nrows = nrows;
      this.ncols = ncols;
      this.nmines = nmines;
      this.nmarked = 0;
      this.nuncovered = 0;
      this.exploded = false;
      // create an array
      this.arr = array2d(nrows, ncols, () => ({
        mine: false,
        state: STATE_HIDDEN,
        count: 0,
      }));
    }

    clear() {
      while (board.firstChild) {
        board.removeChild(board.firstChild);
      }
    }

    count(row, col) {
      const c = (r, c) =>
        this.validCoord(r, c) && this.arr[r][c].mine ? 1 : 0;
      let res = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) res += c(row + dr, col + dc);
      return res;
    }
    sprinkleMines(row, col) {
      // prepare a list of allowed coordinates for mine placement
      let allowed = [];
      for (let r = 0; r < this.nrows; r++) {
        for (let c = 0; c < this.ncols; c++) {
          if (Math.abs(row - r) > 2 || Math.abs(col - c) > 2)
            allowed.push([r, c]);
        }
      }
      this.nmines = Math.min(this.nmines, allowed.length);
      for (let i = 0; i < this.nmines; i++) {
        let j = rndInt(i, allowed.length - 1);
        [allowed[i], allowed[j]] = [allowed[j], allowed[i]];
        let [r, c] = allowed[i];
        this.arr[r][c].mine = true;
      }
      // erase any marks (in case user placed them) and update counts
      for (let r = 0; r < this.nrows; r++) {
        for (let c = 0; c < this.ncols; c++) {
          if (this.arr[r][c].state == STATE_MARKED)
            this.arr[r][c].state = STATE_HIDDEN;
          this.arr[r][c].count = this.count(r, c);
        }
      }

      let mines = [];
      let counts = [];
      for (let row = 0; row < this.nrows; row++) {
        let s = "";
        for (let col = 0; col < this.ncols; col++) {
          s += this.arr[row][col].mine ? "B" : ".";
        }
        s += "  |  ";
        for (let col = 0; col < this.ncols; col++) {
          s += this.arr[row][col].count.toString();
        }
        mines[row] = s;
      }
      console.log("Mines and counts after sprinkling:");
      console.log(mines.join("\n"), "\n");
    }
    
    // uncovers a cell at a given coordinate
    // this is the 'left-click' functionality
    uncover(row, col) {
      console.log("uncover", row, col);
      // if coordinates invalid, refuse this request
      if (!this.validCoord(row, col)) return false;
      // if this is the very first move, populate the mines, but make
      // sure the current cell does not get a mine
      if (this.nuncovered === 0) {
        this.sprinkleMines(row, col);
        timer();
      }
      // if cell is not hidden, ignore this move
      if (this.arr[row][col].state !== STATE_HIDDEN) return false;
      // floodfill all 0-count cells
      const ff = (r, c) => {
        if (!this.validCoord(r, c)) return;
        if (this.arr[r][c].state !== STATE_HIDDEN) return;
        this.arr[r][c].state = STATE_SHOWN;
        this.nuncovered++;
        if (this.arr[r][c].count !== 0) return;
        ff(r - 1, c - 1);
        ff(r - 1, c);
        ff(r - 1, c + 1);
        ff(r, c - 1);
        ff(r, c + 1);
        ff(r + 1, c - 1);
        ff(r + 1, c);
        ff(r + 1, c + 1);
      };
      ff(row, col);
      // have we hit a mine?
      if (this.arr[row][col].mine) {
        this.exploded = true;
      }

      return true;
    }
    
    // puts a flag on a cell
    // this is the 'right-click' or 'long-tap' functionality
    mark(row, col) {
      console.log("mark", row, col);
      // if coordinates invalid, refuse this request
      if (!this.validCoord(row, col)) return false;
      // if cell already uncovered, refuse this
      console.log("marking previous state=", this.arr[row][col].state);
      if (this.arr[row][col].state === STATE_SHOWN) return false;

      //if too many mines placed refuse;
      if (this.arr[row][col].state == STATE_HIDDEN && mines.innerText == 0) {
        alert("You have placed the max number of flags");
        return false;
      }

      // accept the move and flip the marked status
      this.nmarked += this.arr[row][col].state == STATE_MARKED ? -1 : 1;
      this.arr[row][col].state =
        this.arr[row][col].state == STATE_MARKED ? STATE_HIDDEN : STATE_MARKED;
      return true;
    }
    // returns array of strings representing the rendering of the board
    //      "H" = hidden cell - no bomb
    //      "F" = hidden cell with a mark / flag
    //      "M" = uncovered mine (game should be over now)
    // '0'..'9' = number of mines in adjacent cells
    getRendering() {
      const res = [];
      for (let row = 0; row < this.nrows; row++) {
        let s = "";
        for (let col = 0; col < this.ncols; col++) {
          let a = this.arr[row][col];
          if (this.exploded && a.mine) s += "M";
          else if (a.state === STATE_HIDDEN) s += "H";
          else if (a.state === STATE_MARKED) s += "F";
          else if (a.mine) s += "M";
          else s += a.count.toString();
        }
        res[row] = s;
      }
      return res;
    }

    endGame() {
      message.innerText = "Game Over";
      message.classList.add("error");
      this.drawBoard(this.getRendering(), "END");
    }
    wonGame() {
      message.innerText = "You won";
      message.classList.add("success");
      this.drawBoard(this.getRendering(), "WON");
    }

    getStatus() {
      let done =
        this.exploded ||
        this.nuncovered === this.nrows * this.ncols - this.nmines;
      return {
        done: done,
        exploded: this.exploded,
        nrows: this.nrows,
        ncols: this.ncols,
        nmarked: this.nmarked,
        nuncovered: this.nuncovered,
        nmines: this.nmines,
      };
    }
    drawBoard(gameRender, state) {
      this.clear();

      for (let row = 0; row < this.nrows; row++) {
        const gridRow = document.createElement("div");
        gridRow.setAttribute("id", `${row}`);
        
        if (gridSize === 'easy') {
          gridRow.classList.add("row-easy");
        } else {
          gridRow.classList.add("row-med")
        }
        for (let col = 0; col < this.ncols; col++) {
          const piece = document.createElement("div");
          piece.setAttribute("id", `${row} ${col}`);
          
          if (gridSize === 'easy') {
            piece.classList.add("col-easy");
          } else {
            piece.classList.add("col-med")
          }
          
          if (state !== "END" && state !== "WON") {
            $(piece).on("taphold", tapHander).on("click", clickHandler);
          }

          if (gameRender[row][col] === "F") {
            piece.classList.add("flag");
            let icon = document.createElement('i');
            icon.classList.add('fas');
            icon.classList.add('fa-flag');
            icon.classList.add('flagged');
            piece.appendChild(icon);
          } 
         else if (gameRender[row][col] === "M") {
            piece.classList.add("bomb");
            piece.innerHTML = '<i class="fas fa-bomb""></i>';
         } else if (gameRender[row][col] !== "M" && gameRender[row][col] !== "H" &&
            gameRender[row][col] !== "F") {
            piece.classList.add("seen");
            piece.innerText = gameRender[row][col];
          }
          gridRow.appendChild(piece);
        }
        mines.innerText = game.getStatus().nmines - game.getStatus().nmarked;
        board.appendChild(gridRow);
      }
    }
  }
  return _MSGame;
})();

let game = new MSGame();

// Timer 

let timeField = document.getElementById("time"),
  sec = 0,
  min = 0,
  t;

function add() {
  sec++;
  if (sec >= 60) {
    sec = 0;
    min++;
  }

  timeField.textContent =
    (min ? (min > 9 ? min : "0" + min) : "00") + ":" + (sec > 9 ? sec : "0" + sec);
  timer();
}
function timer() {
  t = setTimeout(add, 1000);
}

const mines = document.querySelector("#mines");
const message = document.querySelector(".message");
const gridElement = document.querySelector(".difficulty");

function resetGrid() {
  game.clear();
  initBoard();
}

let gridSize = "";
gridElement.addEventListener("change", (event) => {
  gridSize = event.target.value;
  initBoard();
});

function initBoard() {
  message.classList.remove("error");
  message.classList.remove("success");
  clearTimeout(t);
  timeField.textContent = "00:00";
  sec = 0;
  min = 0;
  message.innerText = "";
  if (gridSize === "easy") {
    console.log(game.getStatus().nmines);
    mines.innerText = 10;
    game.clear();
    game.init(8, 10, 10);
  } else if (gridSize === "medium") {
    mines.innerText = 40;
    game.clear();
    game.init(14, 18, 40);
  } else {
    mines.innerText = "";
    game.clear();
  }
  console.log(game.getRendering().join("\n"));
  console.log(game.getStatus());
}


