# Päätösmuisti

Demo FDE-tehtävään "ensimmäinen päivä asiakkaalla". Kuvitteellinen asiakas on Kemiran hallituksen
puheenjohtaja. Aineisto on Kemiran julkisia tiedotteita ja avoimia tietolähteitä; Kemira ei ole
osallistunut tämän tekemiseen.

**Demo:** https://ahtavarasmus.github.io/paatosmuisti/ · **Koodi:** https://github.com/ahtavarasmus/paatosmuisti

## Mihin ongelmaan tartuin

Puheenjohtajan huolista tähän: kukaan ei muista, millä perusteilla aiemmat päätökset tehtiin, ja kun
joku kysyy, vastausta kaivetaan viikko. Päätösmuisti kirjaa päätöksen yhdessä oletustensa kanssa
(minkä pitää olla totta, että tämä on yhä hyvä päätös) ja mittaa oletuksia automaattisesti avoimista
tietolähteistä. Kun oletus pettää, päätös nousee listan kärkeen ja muutos näkyy tapahtumissa.

Jätin pois materiaalin tiivistämisen. Se on ilmeisin valinta, ja oikeaa hallitusmateriaalia ei ole
julkisesti saatavilla, joten sitä ei voisi näyttää rehellisesti.

## Vaadittu osa: päätös, oletus ja kolme riippumatonta instrumenttia

- **Päätös:** Kemiran vuoden 2026 näkymät (operatiivinen käyttökate 470-570 M€, 12.2.2026) ja
  samana päivänä päätetty enintään 100 M€:n omien osakkeiden osto-ohjelma, joka nojaa niihin.
- **Oletus**, Kemiran omin sanoin tilinpäätöstiedotteessa: raaka-aineympäristö pysyy vakaana.
- **Instrumentit**, kaikki avoimia ja ilman API-avainta:
  1. Alusliikenne Hormuzinsalmessa, IMF PortWatch (alusten satelliittiseuranta): fyysinen häiriö.
  2. Brent-raakaöljyn hinta, U.S. EIA FRED:n kautta: markkinahinta öljyjohdannaisille.
  3. Kemikaalien tuottajahinnat EU:ssa, Eurostat: mikä osa paineesta on jo ehtinyt hintoihin.

  Lisäksi EU:n paperin ja kartongin tuotanto (Eurostat) mittaa hinnankorotusten läpimenoa ja
  EUR/USD (EKP) dollarioletusta.
- **Riippumattomuus:** eri tiedontuottaja ja eri mekanismi: satelliittidata, markkinahinta ja
  tilastoviraston kysely. Kaksi ensimmäistä liikkuvat samasta syystä, kolmas kertoo kahden kuukauden
  viiveellä, ehtikö paine kustannuksiin.
- **Tulos:** mallin mukaan oletus petti 14.3.2026, 88 päivää ennen 10.6.2026 annettua
  tulosvaroitusta. Osto-ohjelma jatkui 16.6.2026 asti. Liukusäätimellä tämän voi toistaa päivä
  päivältä käyttäen vain sitä tietoa, joka kunakin päivänä oli julkaistu.

## Miten se toimii

1. Instrumentin lukemaa verrataan tasoon, jolla se oli päätöstä tehtäessä. Vain tilannepäivään
   mennessä julkaistu tieto lasketaan mukaan (jokaisella lähteellä on julkaisuviive).
2. Yksi rajansa ylittänyt instrumentti: oletus on paineessa. Kaksi toisistaan riippumatonta:
   oletus ei enää pidä. Yksi instrumentti ei koskaan yksin kaada oletusta.
3. Päätös on yhtä vahva kuin heikoin oletus sen itsensä tai sen pohjana olevien päätösten alla.
4. Rajat on johdettu kunkin instrumentin tavanomaisesta 90 päivän vaihtelusta vertailujaksolla
   6/2024-2/2026 (`npm run calibrate`): varoitusraja on 95. persentiili pyöristettynä, raja sen
   kaksinkertainen. Oikeassa käytössä hallitus kirjaisi rajan päätöstä tehdessään.
5. Uutisvahti on toinen instrumenttilaji: agentti hakisi päivittäin uutisia, jotka ovat
   ristiriidassa oletuksen kanssa, ja ihminen vahvistaa tai hylkää löydöksen. Väärä löydös maksaa
   yhden tarkistuksen, oikea on arvokas tietää.

## Miltä se näyttää

Yksi sivu. Vasemmalla päätökset, yksi kortti kutakin: kortin sisällä päätöksen omat versiot
aikajärjestyksessä, ja kunkin version kohdalla, miten se piti ja mistä päivästä alkaen se oli
paineessa tai petti. Ylhäällä päivän liukusäädin, joka pysyy näkyvissä: oletuksena tämä päivä,
vedettävissä taaksepäin, jolloin kaikki näytetään sillä tiedolla, joka silloin oli julkaistu.
Valitun päätöksen versiot ja toteutumispäivä on merkitty säätimeen, ja oikealla näkyy se versio,
joka valittuna päivänä oli voimassa: päätös itse ylimpänä, siitä alaspäin oletukset, joihin se
nojaa, ja niiden alla instrumentit lukemineen "päätöshetkellä → valittuna päivänä". Lisää päätös
-lomakkeella kirjataan uusi päätös oletuksineen ja instrumentteineen.

## Mitä jätin pois ja miksi

- **Agenttia ei ajeta.** Demossa ei ole kielimallin avainta palvelimella. Uutisvahdin löydökset
  lisätään käsin, ja uuden tietolähteen etsiminen kuvauksen perusteella on vain kuvattu lomakkeessa.
- **Ei palvelinta.** Lisätyt päätökset ja löydökset jäävät selaimeen (localStorage). Tuotannossa ne
  menisivät palvelimelle, ja tilan muutoksesta lähtisi viesti. Nyt muutokset näkyvät
  Tapahtumat-listassa.
- **Sanamuodot ovat tiivistelmiä.** Oletukset on kirjoitettu omin sanoin julkisista tiedotteista,
  ja jokaisen päätöksen kohdalla on linkki alkuperäiseen.
- **Rajat ovat tilastollisia, eivät hallituksen asettamia.** Ne kertovat, mikä on epätavallista,
  eivät mikä on päätökselle merkittävää.
- **Kemiran sisäinen data puuttuu.** Hinnankorotusten toteuma ja omat tuotantohäiriöt mittaisivat
  kaksi oletusta paremmin kuin mikään julkinen lähde.

## Tekoälytyökalut

Koko työ tehtiin Claude Coden kanssa (malli Claude Fable 5.1) Claude-työpöytäsovelluksessa:
lähteiden etsiminen ja koestus, koodi, suomenkieliset tekstit ja sivun testaus selaimessa.

Vahvuudet: avointen rajapintojen löytäminen ja koestaminen minuuteissa, koko sovelluksen runko
yhdessä istunnossa, rajojen johtaminen datasta mutu-tuntuman sijaan. Heikkoudet: ensimmäinen
käyttöliittymä oli liian monimutkainen ja vaati ihmisen linjauksen, tiivistelmistä luetut faktat
pitää tarkistaa alkuperäisistä lähteistä, ja valinnat siitä mitä rakennetaan ja mitä jätetään pois
olivat ihmisen tehtäviä.

## Ajaminen

```bash
npm install
npm run fetch        # hakee sarjat avoimista lähteistä
npm run dev          # sivu osoitteessa http://localhost:5173
npm test             # laskentasäännöt
npm run calibrate    # mistä rajat tulevat
npm run report -- 2026-03-20   # tilanne minä tahansa päivänä tekstinä
```

Julkaisu: `.github/workflows/pages.yml` hakee sarjat joka aamu, ajaa testit ja julkaisee sivun
GitHub Pagesiin.

## Lähteet

Kemiran pörssitiedotteet ja raportit: pitkän aikavälin tavoitteet 25.9.2024, tilinpäätöstiedote
ja osto-ohjelma 12.2.2026, osavuosikatsaus 24.4.2026, tulosvaroitus 10.6.2026, osto-ohjelman
päättyminen 16.6.2026, puolivuosikatsaus 17.7.2026. Linkit ovat kunkin päätöksen sivulla.

Tietolähteet: IMF PortWatch, FRED (U.S. EIA), Eurostat, Euroopan keskuspankki.
