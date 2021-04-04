import {
  ANDSearchQuery,
  DistanceSearch,
  FromDateSearch,
  MaxRatingSearch,
  MaxResolutionSearch,
  MinRatingSearch,
  MinResolutionSearch,
  OrientationSearch,
  ORSearchQuery,
  RangeSearch,
  SearchListQuery,
  SearchQueryDTO,
  SearchQueryTypes,
  SomeOfSearchQuery,
  TextSearch,
  TextSearchQueryMatchTypes,
  TextSearchQueryTypes,
  ToDateSearch
} from './entities/SearchQueryDTO';
import {Utils} from './Utils';


export interface QueryKeywords {
  portrait: string;
  landscape: string;
  orientation: string;
  kmFrom: string;
  maxResolution: string;
  minResolution: string;
  maxRating: string;
  minRating: string;
  NSomeOf: string;
  someOf: string;
  or: string;
  and: string;
  from: string;
  to: string;
  caption: string;
  directory: string;
  file_name: string;
  keyword: string;
  person: string;
  position: string;
}

export class SearchQueryParser {
  constructor(private keywords: QueryKeywords) {
  }

  public static stringifyText(text: string, matchType = TextSearchQueryMatchTypes.like): string {
    if (matchType === TextSearchQueryMatchTypes.exact_match) {
      return '"' + text + '"';
    }
    if (text.indexOf(' ') !== -1) {
      return '(' + text + ')';
    }
    return text;
  }

  private static stringifyDate(time: number): string {
    const date = new Date(time);
    // simplify date with yeah only if its first of jan
    if (date.getMonth() === 0 && date.getDate() === 1) {
      return date.getFullYear().toString();
    }
    return this.stringifyText(date.toLocaleDateString());
  }

  private static parseDate(text: string): number {
    if (text.charAt(0) === '"' || text.charAt(0) === '(') {
      text = text.substring(1);
    }
    if (text.charAt(text.length - 1) === '"' || text.charAt(text.length - 1) === ')') {
      text = text.substring(0, text.length - 1);
    }
    // it is the year only
    if (text.length === 4) {
      const d = new Date(2000, 0, 1);
      d.setFullYear(parseInt(text, 10));
      return d.getTime();
    }
    return Date.parse(text);
  }

  public parse(str: string, implicitOR = true): SearchQueryDTO {
    str = str.replace(/\s\s+/g, ' ') // remove double spaces
      .replace(/:\s+/g, ':').replace(/\)(?=\S)/g, ') ').trim();

    if (str.charAt(0) === '(' && str.charAt(str.length - 1) === ')') {
      str = str.slice(1, str.length - 1);
    }
    const fistSpace = (start = 0) => {
      const bracketIn = [];
      let quotationMark = false;
      for (let i = start; i < str.length; ++i) {
        if (str.charAt(i) === '"') {
          quotationMark = !quotationMark;
          continue;
        }
        if (str.charAt(i) === '(') {
          bracketIn.push(i);
          continue;
        }
        if (str.charAt(i) === ')') {
          bracketIn.pop();
          continue;
        }

        if (quotationMark === false &&
          bracketIn.length === 0 &&
          str.charAt(i) === ' ') {
          return i;
        }
      }
      return str.length - 1;
    };

    // tokenize
    const tokenEnd = fistSpace();

    if (tokenEnd !== str.length - 1) {
      if (str.startsWith(' ' + this.keywords.and, tokenEnd)) {
        return <ANDSearchQuery>{
          type: SearchQueryTypes.AND,
          list: [this.parse(str.slice(0, tokenEnd), implicitOR), // trim brackets
            this.parse(str.slice(tokenEnd + (' ' + this.keywords.and).length), implicitOR)]
        };
      } else if (str.startsWith(' ' + this.keywords.or, tokenEnd)) {
        return <ORSearchQuery>{
          type: SearchQueryTypes.OR,
          list: [this.parse(str.slice(0, tokenEnd), implicitOR), // trim brackets
            this.parse(str.slice(tokenEnd + (' ' + this.keywords.or).length), implicitOR)]
        };
      } else { // Relation cannot be detected
        return <SearchListQuery>{
          type: implicitOR === true ? SearchQueryTypes.OR : SearchQueryTypes.UNKNOWN_RELATION,
          list: [this.parse(str.slice(0, tokenEnd), implicitOR), // trim brackets
            this.parse(str.slice(tokenEnd), implicitOR)]
        };
      }
    }
    if (str.startsWith(this.keywords.someOf + ':') ||
      new RegExp('^\\d*-' + this.keywords.NSomeOf + ':').test(str)) {
      const prefix = str.startsWith(this.keywords.someOf + ':') ?
        this.keywords.someOf + ':' :
        new RegExp('^\\d*-' + this.keywords.NSomeOf + ':').exec(str)[0];
      let tmpList: any = this.parse(str.slice(prefix.length + 1, -1), false); // trim brackets
      //  console.log(JSON.stringify(tmpList, null, 4));
      const unfoldList = (q: SearchListQuery): SearchQueryDTO[] => {
        if (q.list) {
          if (q.type === SearchQueryTypes.UNKNOWN_RELATION) {
            return [].concat.apply([], q.list.map(e => unfoldList(<any>e))); // flatten array
          } else {
            q.list.forEach(e => unfoldList(<any>e));
          }
        }
        return [q];
      };
      tmpList = unfoldList(<SearchListQuery>tmpList);
      const ret = <SomeOfSearchQuery>{
        type: SearchQueryTypes.SOME_OF,
        list: tmpList
      };
      if (new RegExp('^\\d*-' + this.keywords.NSomeOf + ':').test(str)) {
        ret.min = parseInt(new RegExp(/^\d*/).exec(str)[0], 10);
      }
      return ret;
    }

    if (str.startsWith(this.keywords.from + ':')) {
      return <FromDateSearch>{
        type: SearchQueryTypes.from_date,
        value: SearchQueryParser.parseDate(str.substring((this.keywords.from + ':').length))
      };
    }
    if (str.startsWith(this.keywords.to + ':')) {
      return <ToDateSearch>{
        type: SearchQueryTypes.to_date,
        value: SearchQueryParser.parseDate(str.substring((this.keywords.to + ':').length))
      };
    }

    if (str.startsWith(this.keywords.minRating + ':')) {
      return <MinRatingSearch>{
        type: SearchQueryTypes.min_rating,
        value: parseInt(str.slice((this.keywords.minRating + ':').length), 10)
      };
    }
    if (str.startsWith(this.keywords.maxRating + ':')) {
      return <MaxRatingSearch>{
        type: SearchQueryTypes.max_rating,
        value: parseInt(str.slice((this.keywords.maxRating + ':').length), 10)
      };
    }
    if (str.startsWith(this.keywords.minResolution + ':')) {
      return <MinResolutionSearch>{
        type: SearchQueryTypes.min_resolution,
        value: parseInt(str.slice((this.keywords.minResolution + ':').length), 10)
      };
    }
    if (str.startsWith(this.keywords.maxResolution + ':')) {
      return <MaxResolutionSearch>{
        type: SearchQueryTypes.max_resolution,
        value: parseInt(str.slice((this.keywords.maxResolution + ':').length), 10)
      };
    }
    if (new RegExp('^\\d*-' + this.keywords.kmFrom + ':').test(str)) {
      let from = str.slice(new RegExp('^\\d*-' + this.keywords.kmFrom + ':').exec(str)[0].length);
      if (from.charAt(0) === '(' && from.charAt(from.length - 1) === ')') {
        from = from.slice(1, from.length - 1);
      }
      return <DistanceSearch>{
        type: SearchQueryTypes.distance,
        distance: parseInt(new RegExp(/^\d*/).exec(str)[0], 10),
        from: {text: from}
      };
    }

    if (str.startsWith(this.keywords.orientation + ':')) {
      return <OrientationSearch>{
        type: SearchQueryTypes.orientation,
        landscape: str.slice((this.keywords.orientation + ':').length) === this.keywords.landscape
      };
    }

    // parse text search
    const tmp = TextSearchQueryTypes.map(type => ({
      key: (<any>this.keywords)[SearchQueryTypes[type]] + ':',
      queryTemplate: <TextSearch>{type: type, text: ''}
    }));
    for (let i = 0; i < tmp.length; ++i) {
      if (str.startsWith(tmp[i].key)) {
        const ret: TextSearch = Utils.clone(tmp[i].queryTemplate);
        if (str.charAt(tmp[i].key.length) === '"' && str.charAt(str.length - 1) === '"') {
          ret.text = str.slice(tmp[i].key.length + 1, str.length - 1);
          ret.matchType = TextSearchQueryMatchTypes.exact_match;
        } else if (str.charAt(tmp[i].key.length) === '(' && str.charAt(str.length - 1) === ')') {
          ret.text = str.slice(tmp[i].key.length + 1, str.length - 1);
        } else {
          ret.text = str.slice(tmp[i].key.length);
        }
        return ret;
      }
    }


    return <TextSearch>{type: SearchQueryTypes.any_text, text: str};
  }

  public stringify(query: SearchQueryDTO): string {
    if (!query || !query.type) {
      return '';
    }
    switch (query.type) {
      case SearchQueryTypes.AND:
        return '(' + (<SearchListQuery>query).list.map(q => this.stringify(q)).join(' ' + this.keywords.and + ' ') + ')';

      case SearchQueryTypes.OR:
        return '(' + (<SearchListQuery>query).list.map(q => this.stringify(q)).join(' ' + this.keywords.or + ' ') + ')';

      case SearchQueryTypes.SOME_OF:
        if ((<SomeOfSearchQuery>query).min) {
          return (<SomeOfSearchQuery>query).min + '-' + this.keywords.NSomeOf + ':(' +
            (<SearchListQuery>query).list.map(q => this.stringify(q)).join(' ') + ')';
        }
        return this.keywords.someOf + ':(' +
          (<SearchListQuery>query).list.map(q => this.stringify(q)).join(' ') + ')';


      case SearchQueryTypes.orientation:
        return this.keywords.orientation + ':' + ((<OrientationSearch>query).landscape ? this.keywords.landscape : this.keywords.portrait);

      case SearchQueryTypes.from_date:
        if (!(<FromDateSearch>query).value) {
          return '';
        }
        return this.keywords.from + ':' +
          SearchQueryParser.stringifyDate((<FromDateSearch>query).value);
      case SearchQueryTypes.to_date:
        if (!(<ToDateSearch>query).value) {
          return '';
        }
        return this.keywords.to + ':' +
          SearchQueryParser.stringifyDate((<ToDateSearch>query).value);
      case SearchQueryTypes.min_rating:
        return this.keywords.minRating + ':' + (isNaN((<RangeSearch>query).value) ? '' : (<RangeSearch>query).value);
      case SearchQueryTypes.max_rating:
        return this.keywords.maxRating + ':' + (isNaN((<RangeSearch>query).value) ? '' : (<RangeSearch>query).value);
      case SearchQueryTypes.min_resolution:
        return this.keywords.minResolution + ':' + (isNaN((<RangeSearch>query).value) ? '' : (<RangeSearch>query).value);
      case SearchQueryTypes.max_resolution:
        return this.keywords.maxResolution + ':' + (isNaN((<RangeSearch>query).value) ? '' : (<RangeSearch>query).value);
      case SearchQueryTypes.distance:
        if ((<DistanceSearch>query).from.text.indexOf(' ') !== -1) {
          return (<DistanceSearch>query).distance + '-' + this.keywords.kmFrom + ':(' + (<DistanceSearch>query).from.text + ')';
        }
        return (<DistanceSearch>query).distance + '-' + this.keywords.kmFrom + ':' + (<DistanceSearch>query).from.text;

      case SearchQueryTypes.any_text:
        return SearchQueryParser.stringifyText((<TextSearch>query).text, (<TextSearch>query).matchType);

      case SearchQueryTypes.person:
      case SearchQueryTypes.position:
      case SearchQueryTypes.keyword:
      case SearchQueryTypes.caption:
      case SearchQueryTypes.file_name:
      case SearchQueryTypes.directory:
        if (!(<TextSearch>query).text) {
          return '';
        }
        return (<any>this.keywords)[SearchQueryTypes[query.type]] + ':' +
          SearchQueryParser.stringifyText((<TextSearch>query).text, (<TextSearch>query).matchType);

      default:
        throw new Error('Unknown type: ' + query.type);
    }
  }
}
