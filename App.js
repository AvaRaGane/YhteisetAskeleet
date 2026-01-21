import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, PermissionsAndroid, Platform, Alert } from 'react-native';
import { Pedometer } from 'expo-sensors';
import GoogleFit, { Scopes } from 'react-native-google-fit';

export default function App() {
  const [todaySteps, setTodaySteps] = useState(0);
  const [yesterdaySteps, setYesterdaySteps] = useState(0);

  const iOSSteps = async () => { //iOS askelmäärän funktio
    const isAvailable = await Pedometer.isAvailableAsync();
    if (!isAvailable) return;

    // Tänään 00:00
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Eilen 00:00
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(todayStart.getDate() - 1);

    // Eilen 23:59:59
    const yesterdayEnd = new Date(todayStart);

    // Eiliset askeleet
    const yesterdayResult = await Pedometer.getStepCountAsync(
      yesterdayStart,
      yesterdayEnd
    );
    setYesterdaySteps(yesterdayResult?.steps ?? 0);

    // Tämän päivän askeleet
    const todayResult = await Pedometer.getStepCountAsync(
      todayStart,
      new Date()
    );
    setTodaySteps(todayResult?.steps ?? 0);
  };

    const requestActivityPermission = async () => { //Kysytään Androidin lupa
    console.log("kysytään androidin lupaa")  
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
          {
            title: "Lupa liikkumisen seurantaan",
            message: "Sovellus tarvitsee luvan nähdäkseen askeleet.",
            buttonPositive: "OK"
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const androidSteps = async () => {
    // 2. Kutsutaan lupakyselyä ENNEN Google Fit -kirjautumista
    const hasPermission = await requestActivityPermission();

    if (!hasPermission) {
      console.log("lupaa ei ole annettu");
      console.log("Virhe: Android-lupa evätty");
      Alert.alert("Lupa puuttuu", "Et antanut lupaa fyysiseen aktiivisuuteen. Käy asetuksissa sallimassa se.");
      return;
    }

    const options = {
      scopes: [
        Scopes.FITNESS_ACTIVITY_READ,
        Scopes.FITNESS_BODY_READ,
      ],
    };

    try {
      const authResult = await GoogleFit.authorize(options);

      if (authResult.success) {
        console.log("authResult.success")
        console.log('Yhteys OK! Haetaan tietoja...');
        fetchSteps();
      } else {
        console.log('Lupaa ei myönnetty ' + authResult.message);
      }
    } catch (error) {
      console.log('Virhe auth: ' + error.message);
    }
  };

  const fetchSteps = async () => {
    const now = new Date();

    // 1. Määritellään tämän päivän alku (klo 00:00)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 2. Määritellään eilisen päivän alku (Tänään - 1 päivä)
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfToday.getDate() - 1);

    const opt = {
      startDate: startOfYesterday.toISOString(), // Aloitetaan eilisestä
      endDate: now.toISOString(),                // Lopetetaan tähän hetkeen
      bucketUnit: "DAY",
      bucketInterval: 1,
    };

    try {
      const res = await GoogleFit.getDailyStepCountSamples(opt);
      //console.log("Google Fit vastaus:", JSON.stringify(res, null, 2));

      // Etsitään luotettava lähde (kuten aiemminkin)
      const reliableSource = res.find(r =>
        r.source === "com.google.android.gms:estimated_steps" ||
        r.source === "com.google.android.gms:merge_step_deltas"
      );

      let today = 0;
      let yesterday = 0;

      if (reliableSource && reliableSource.steps.length > 0) {
        // 3. Käydään läpi kaikki löytyneet päivät (steps-taulukko)
        reliableSource.steps.forEach(step => {
          // step.date on yleensä muodossa "YYYY-MM-DD" tai aikaleima.
          // Tarkistetaan mihin päivään tämä merkintä kuuluu.

          // Luodaan päiväolio datan perusteella
          // (Google Fit voi palauttaa päivämäärän hieman eri muodoissa, 
          // mutta yleensä 'endDate' tai 'date' toimii)
          const stepDate = new Date(step.endDate || step.date);

          // Jos datan aikaleima on pienempi kuin tämän päivän alku -> se on EILEN
          if (stepDate.getTime() < startOfToday.getTime()) {
            yesterday += step.value;
          } else {
            // Muuten se on TÄNÄÄN
            today += step.value;
          }
        });
      }

      // 4. Päivitetään molemmat tilat
      setTodaySteps(today);
      setYesterdaySteps(yesterday);

      console.log(`Tänään: ${today}, Eilen: ${yesterday}`);

    } catch (err) {
      console.log("Virhe haussa:", err);
      console.log("Virhe haussa: " + err.message);
    }
  };

  useEffect(() => {
    if (Platform.OS === 'android') {
      console.log("laitteena android")
      androidSteps();
    } else if (Platform.OS === 'ios') {
      console.log("laitteena iOS")
      iOSSteps();
    }
  }, []);

  return (
    <View style={styles.container}>
      <Text>Askelia tänään: {todaySteps}</Text>
      <Text>Askelia eilen: {yesterdaySteps}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
