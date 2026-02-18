import axios from "axios";
import * as cheerio from "cheerio";
import { v4 as uuidv4 } from "uuid";
import * as iconv from "iconv-lite";

const RUTRACKER_BASE_URL = "https://rutracker.org/forum";
